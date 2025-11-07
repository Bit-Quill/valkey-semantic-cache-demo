# Airline Helpdesk Chat App

An AI-powered airline helpdesk demonstrating measurable cost and time savings through semantic caching with Valkey vector database and AWS Bedrock.

## 🎯 Project Goals

This application showcases the real-world value of semantic search and caching by:

- Answering customer questions instantly when semantically similar questions exist in cache
- Demonstrating dollar savings (avoiding LLM API calls) and time savings (sub-100ms cache responses)
- Providing a modern, conference-ready demo of Valkey's vector search capabilities

## ✨ Key Features

- **Semantic Question Matching**: Uses vector embeddings to find similar questions (0.85 similarity threshold)
- **Real-time Savings Display**: Shows accumulated cost and time savings with semi-opaque overlay
- **Similarity Score Visualization**: Displays how closely cached questions match user queries
- **Intelligent Fallback**: Automatically queries AWS Bedrock when no cached answer meets threshold
- **Auto-cache Learning**: Saves new LLM responses to improve future performance
- **Modern UI**: Inspired by Brave's new tab design with centered chat interface

## 🏗️ Architecture

```
┌─────────────┐
│   Frontend  │ (React + TypeScript)
│  (Port 3000)│
└──────┬──────┘
       │
       │ HTTP/WebSocket
       │
┌──────▼──────┐
│   Backend   │ (Express + TypeScript + Valkey Glide)
│             │
└──┬───────┬──┘
   │       │
   │       │
   ▼       ▼
┌─────┐  ┌──────────┐
│Valkey│  │  Bedrock │
│Vector│  │ (Sonnet  │
│  DB  │  │   4.5)   │
└─────┘  └──────────┘
```

### Data Flow

1. User asks question → Frontend sends to Backend
2. Backend generates embedding (Bedrock Titan Embeddings)
3. Backend searches Valkey vector index for similar questions
4. **If match found (≥0.85 similarity)**: Return cached answer, update stats
5. **If no match**: Query Bedrock LLM, cache response with embedding, update stats
6. Frontend displays answer + savings stats

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- AWS credentials configured (for Bedrock access)
- Node.js 20+ (for local development)

### Running the Application

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd airline-helpdesk-chat-app
   ```

2. **Set up AWS credentials**

   ```bash
   # in ~/.aws/credentials
   [default]
   aws_access_key_id=your_key
   aws_secret_access_key=your_secret
   aws_region=us-east-1
   ```

   or

   ```bash
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret
   export AWS_REGION=us-east-1
   ```

3. **Start the application**

   ```bash
   docker-compose up
   ```

4. **Open your browser**

   ```
   http://localhost:3000
   ```

### Resetting the Demo

For conference presentations, you can reset the cache and stats:

**Option 1: Restart containers**

```bash
docker-compose down -v
docker-compose up
```

**Option 2: Use reset script** (when implemented)

```bash
./scripts/reset-demo.sh
```

## 🛠️ Tech Stack

### Frontend

- **React** with TypeScript
- **Vite** for fast development
- Modern CSS with semi-opaque overlays

### Backend

- **Node.js** with TypeScript
- **Express** for REST API
- **Valkey Glide** for vector database operations
- **AWS SDK** for Bedrock integration

### Infrastructure

- **Valkey Bundle** (vector database with search module)
- **AWS Bedrock** (Sonnet 4.5 for LLM, Titan for embeddings)
- **Docker Compose** for orchestration

## 📊 Data Structure

### Vector Index (Semantic Search)

```
Key: q:vector:{uuid}
Fields:
  - question_id (TAG)
  - embedding (VECTOR HNSW, 1536 dimensions)
  - timestamp (NUMERIC)
```

### Question-Answer Store

```
Key: qa:{question_id}
Hash:
  - question (string)
  - answer (string)
  - tokens_used (numeric)
  - cost (numeric)
  - created_at (timestamp)
```

### Stats Store

```
Key: stats:global
Hash:
  - total_questions (numeric)
  - cache_hits (numeric)
  - cache_misses (numeric)
  - total_savings_dollars (numeric)
  - total_savings_seconds (numeric)
```

## 🗺️ Project Roadmap

### Phase 1: Foundation ✅

- [x] Project specification and architecture
- [x] Technology stack decisions
- [x] Repository structure

### Phase 2: Backend Core (In Progress)

- [ ] Express server with health endpoints
- [ ] Valkey Glide client integration
- [ ] Vector index creation and management
- [ ] Stats tracking implementation
- [ ] Docker-compose configuration

### Phase 3: LLM Integration

- [ ] AWS Bedrock client setup
- [ ] Embedding generation (Titan)
- [ ] LLM query handler (Sonnet 4.5)
- [ ] Cache miss flow implementation
- [ ] Auto-caching of new responses

### Phase 4: Frontend Development

- [ ] React app scaffold
- [ ] Chat interface (centered design)
- [ ] Stats overlay (semi-opaque)
- [ ] Similarity score display
- [ ] Error handling UI
- [ ] Loading states

### Phase 5: Integration & Testing

- [ ] End-to-end flow testing
- [ ] Error handling (4xx, 5xx)
- [ ] Network failure handling
- [ ] Performance optimization

### Phase 6: Demo Preparation

- [ ] Seed database with 30-40 Q&A pairs
- [ ] Reset mechanism
- [ ] Demo script/walkthrough
- [ ] Final polish and bug fixes

## 🎪 Conference Demo Flow

1. **Fresh Start**: Show empty/reset state
2. **First Question**: "How do I change my seat?"
   - Cache miss → LLM call
   - Show cost: ~$0.002
   - Show time: ~2.5 seconds
3. **Exact Repeat**: Same question
   - Cache hit
   - Show savings: $0.002, 2.4 seconds
4. **Semantic Match**: "How can I modify my seat assignment?"
   - Cache hit with 0.91 similarity
   - Show cumulative savings
5. **New Question**: Demonstrates cache growth

## 📝 Configuration

### Environment Variables

**Backend**

```env
VALKEY_HOST=valkey
VALKEY_PORT=6379
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-5-v2
EMBEDDING_MODEL_ID=amazon.titan-embed-text-v1
SIMILARITY_THRESHOLD=0.85
PORT=4000
```

**Frontend**

```env
VITE_API_URL=http://localhost:4000
```

## 🤝 Development Principles

- **Incremental Development**: Small, testable changes
- **Commit Often**: Frequent commits with clear messages
- **TDD Where Applicable**: Red → Green → Refactor for business logic
- **Error Handling First**: No silent failures, user-friendly error messages
- **Progress Tracking**: See `Progress.md` for current status

## 📦 Project Structure

```
valkey-semantic-cache-demo/
├── README.md
├── Progress.md
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── valkey/
│   │   ├── bedrock/
│   │   ├── routes/
│   │   └── types/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── styles/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── seed/
│   └── dump.rdb
└── scripts/
    └── reset-demo.sh
```

## 🐛 Troubleshooting

### Valkey connection fails

- Ensure Docker containers are running: `docker-compose ps`
- Check Valkey health: `valkey-cli ping`
- Review backend logs: `docker-compose logs backend`

### AWS Bedrock errors

- Verify AWS credentials are set
- Confirm region supports Bedrock (us-east-1 recommended)
- Check IAM permissions for Bedrock access

### Frontend can't reach backend

- Verify backend is running on port 4000
- Check CORS configuration
- Review browser console for errors

## 📄 License

This project is built for demonstration purposes showcasing Valkey vector database capabilities.

## 🙏 Acknowledgments

- **Valkey** for vector database capabilities
- **AWS Bedrock** for LLM and embedding services
- Built for the open-source community

---

**Status**: Under active development | See `Progress.md` for current milestone
