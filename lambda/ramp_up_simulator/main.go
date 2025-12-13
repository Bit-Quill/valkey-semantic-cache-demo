package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand/v2"
	"os"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockagentcore"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type SeedQuestions struct {
	Version             string     `json:"version"`
	Description         string     `json:"description"`
	SimilarityThreshold float64    `json:"similarity-threshold"`
	Scenarios           []Scenario `json:"scenarios"`
}

type Scenario struct {
	ID           string   `json:"id"`
	Category     string   `json:"category"`
	BaseQuestion string   `json:"base_question"`
	Variations   []string `json:"variations"`
}

type LambdaRequest struct {
	RampDurationSecs int  `json:"ramp_duration_secs,omitempty"` // default 60
	RampStartRPS     int  `json:"ramp_start_rps,omitempty"`     // default 1
	RampEndRPS       int  `json:"ramp_end_rps,omitempty"`       // default 100
	DryRun           bool `json:"dry_run,omitempty"`            // skip actual invocations
}

type LambdaResponse struct {
	TotalRequests int64   `json:"total_requests"`
	Successes     int64   `json:"successes"`
	Failures      int64   `json:"failures"`
	DurationSecs  float64 `json:"duration_secs"`
	AvgRPS        float64 `json:"avg_rps"`
	Message       string  `json:"message"`
}

// Configuration from environment variables
type Config struct {
	AgentCoreRuntimeARN string
	SeedQuestionsBucket string
	SeedQuestionsKey    string
}

var (
	cfg             Config
	s3Client        *s3.Client
	agentCoreClient *bedrockagentcore.Client
	baseQuestions   []string // 50 base questions (cache primers)
	variations      []string // 450 variations
	sessionIDs      []string
	questionsLoaded bool
	loadMu          sync.Mutex
)

const numSessions = 20

func loadConfig() {
	cfg = Config{
		AgentCoreRuntimeARN: os.Getenv("AGENTCORE_RUNTIME_ARN"),
		SeedQuestionsBucket: os.Getenv("SEED_QUESTIONS_BUCKET"),
		SeedQuestionsKey:    os.Getenv("SEED_QUESTIONS_KEY"),
	}

	if cfg.SeedQuestionsKey == "" {
		cfg.SeedQuestionsKey = "seed-questions.json"
	}

	if cfg.AgentCoreRuntimeARN == "" {
		log.Println("WARNING: AGENTCORE_RUNTIME_ARN not set")
	}

	if cfg.SeedQuestionsBucket == "" {
		log.Println("WARNING: SEED_QUESTIONS_BUCKET not set")
	}
}

func init() {
	loadConfig()

	// Initialize AWS SDK clients
	awsCfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}

	s3Client = s3.NewFromConfig(awsCfg)
	agentCoreClient = bedrockagentcore.NewFromConfig(awsCfg)
}

func loadQuestionsFromS3(ctx context.Context) error {
	loadMu.Lock()
	defer loadMu.Unlock()

	if questionsLoaded {
		return nil
	}

	log.Printf("Loading seed questions from s3://%s/%s", cfg.SeedQuestionsBucket, cfg.SeedQuestionsKey)

	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &cfg.SeedQuestionsBucket,
		Key:    &cfg.SeedQuestionsKey,
	})
	if err != nil {
		return fmt.Errorf("failed to get S3 object: %w", err)
	}

	defer result.Body.Close()

	var seedData SeedQuestions
	if err := json.NewDecoder(result.Body).Decode(&seedData); err != nil {
		return fmt.Errorf("failed to parse seed questions JSON: %w", err)
	}

	// Separate base questions from variations for priming strategy
	for _, scenario := range seedData.Scenarios {
		baseQuestions = append(baseQuestions, scenario.BaseQuestion)
		variations = append(variations, scenario.Variations...)
	}

	log.Printf("Loaded %d base questions and %d variations from %d scenarios", len(baseQuestions), len(variations), len(seedData.Scenarios))
	questionsLoaded = true
	return nil
}

func initSessionIdDs() {
	sessionIDs = make([]string, numSessions)
	for i := range numSessions {
		sessionIDs[i] = fmt.Sprintf("ramp-sim-%d-%d", time.Now().UnixNano(), i)
	}
	log.Printf("initialized %d session IDs", len(sessionIDs))
}

func invokeAgentCore(ctx context.Context, question string) error {
	payload := map[string]string{
		"request_text": question,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	sessionID := sessionIDs[rand.IntN(len(sessionIDs))]

	input := &bedrockagentcore.InvokeAgentRuntimeInput{
		AgentRuntimeArn:  &cfg.AgentCoreRuntimeARN,
		Payload:          payloadBytes,
		RuntimeSessionId: &sessionID,
	}

	_, err = agentCoreClient.InvokeAgentRuntime(ctx, input)
	if err != nil {
		return fmt.Errorf("InvokeAgentRuntime failed: %w", err)
	}
	return nil
}

func handleRequest(ctx context.Context, req LambdaRequest) (LambdaResponse, error) {
	// Set defaults
	if req.RampDurationSecs == 0 {
		req.RampDurationSecs = 60
	}
	if req.RampStartRPS == 0 {
		req.RampStartRPS = 1
	}
	if req.RampEndRPS == 0 {
		req.RampEndRPS = 100
	}

	// Load questions from S3
	if err := loadQuestionsFromS3(ctx); err != nil {
		return LambdaResponse{}, fmt.Errorf("failed to load questions from S3 s3://%s/%s: %w",
			cfg.SeedQuestionsBucket, cfg.SeedQuestionsKey, err)
	}

	initSessionIdDs()

	// Execute ramp-up
	start := time.Now()
	totalReqs, successes, failures := executeRampUp(ctx, req)
	duration := time.Since(start).Seconds()

	return LambdaResponse{
		TotalRequests: totalReqs,
		Successes:     successes,
		Failures:      failures,
		DurationSecs:  duration,
		AvgRPS:        float64(totalReqs) / duration,
		Message:       fmt.Sprintf("Ramp-up complete: %d/%d successful", successes, totalReqs),
	}, nil
}

func executeRampUp(ctx context.Context, req LambdaRequest) (int64, int64, int64) {
	var totalReqs, successes, failures int64

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	elapsed := 0
	for range ticker.C {
		if elapsed >= req.RampDurationSecs {
			break
		}

		// Linear ramp: RPS = start + (end - start) * (elapsed / duration)
		progress := float64(elapsed) / float64(req.RampDurationSecs)
		currentRPS := req.RampStartRPS + int(float64(req.RampEndRPS-req.RampStartRPS)*progress)

		log.Printf("[%ds] Target RPS: %d | Total: %d | Success: %d | Failures: %d",
			elapsed, currentRPS, totalReqs, successes, failures)

		// Launch goroutines for this second's requests
		var wg sync.WaitGroup
		for i := range currentRPS {
			wg.Add(1)
			requestIndex := int(totalReqs) + i
			go func(idx int) {
				defer wg.Done()

				question := selectQuestion(elapsed, req.RampDurationSecs, idx)
				err := invokeAgentCore(ctx, question)

				loadMu.Lock()
				totalReqs++
				if err != nil {
					failures++
					log.Printf("Request failed: %v", err)
				} else {
					successes++
				}
				loadMu.Unlock()
			}(requestIndex)
		}
		wg.Wait()
		elapsed++
	}

	log.Printf("Ramp-up complete: %d total, %d success, %d failures", totalReqs, successes, failures)
	return totalReqs, successes, failures
}

func selectQuestion(elapsedSecs, totalDuration, requestIndex int) string {
	// First half (30s): deterministically cycle through ALL base questions
	// This guarantees every base question primes the cache exactly once
	if elapsedSecs < totalDuration/2 {
		return baseQuestions[requestIndex%len(baseQuestions)]
	}
	// Second half: cycle through variations (should hit cache)
	return variations[requestIndex%len(variations)]
}

func main() {
	lambda.Start(handleRequest)
}
