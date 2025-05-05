# Production-Level Chatbot

A production-ready, scalable, and secure chatbot application built with Node.js, TypeScript, React, and MongoDB.

## Features

- **Robust Backend**: Express.js with TypeScript for type safety
- **Responsive Frontend**: React with Tailwind CSS
- **Secure Authentication**: JWT-based authentication with proper encryption
- **AI Integration**: Flexible integration with OpenAI or Anthropic APIs
- **Database**: MongoDB for storing conversations and user data
- **Caching**: Redis for response caching and rate limiting
- **Monitoring**: Prometheus & Grafana dashboards
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Containerization**: Docker and Docker Compose for easy deployment
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Security**: HTTPS, rate limiting, input validation, and security headers

## Architecture

The application follows a modern microservices architecture:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │     │    Backend   │     │     AI      │
│    React    │────▶│  Node.js &   │────▶│   Service   │
│ Tailwind CSS│     │   Express    │     │ OpenAI/Claude│
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
       ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
       │     Redis    │    │   MongoDB   │    │   Metrics   │
       │  Caching &   │◀──▶│  Database   │    │ Prometheus  │
       │ Rate Limiting│    │             │    │  & Grafana  │
       └─────────────┘    └─────────────┘    └─────────────┘
```

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- MongoDB (for local development)
- Redis (for local development)
- API key from OpenAI or Anthropic

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/production-chatbot.git
   cd production-chatbot
   ```

2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Build and start the services:
   ```bash
   docker-compose up -d
   ```

4. Access the application:
   - Frontend: http://localhost:80
   - Backend API: http://localhost:80/api
   - Health check: http://localhost:80/health
   - Monitoring: http://localhost:3000 (Grafana)

## Development Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

The server will start on http://localhost:5000.

### Frontend

```bash
cd frontend
npm install
npm start
```

The development server will start on http://localhost:3000.

## Monitoring & Observability

- Metrics: http://localhost:9090 (Prometheus)
- Dashboards: http://localhost:3000 (Grafana)
- Logs: http://localhost:5601 (Kibana)

## Deployment

The application is designed to be deployed to any infrastructure that supports Docker Compose. For production environments, we recommend using a managed Kubernetes service like AWS EKS, Google GKE, or Azure AKS.

### Using Docker Compose

```bash
# Deploy using the deployment script
./deploy.sh
```

### Using GitHub Actions (CI/CD)

The repository includes GitHub Actions workflows for continuous integration and deployment. To use them:

1. Set up the required secrets in your GitHub repository settings
2. Push to the main branch to trigger the workflow

## Security Considerations

This chatbot has been built with security as a priority:

- All user passwords are hashed using bcrypt
- JWT tokens are used for authentication
- HTTPS is enforced in production
- Rate limiting prevents brute force attacks
- HTTP security headers are set using Helmet
- Input validation is performed on all user inputs
- Regular security scans are part of the CI pipeline

## Scaling

The architecture allows for horizontal scaling:

- Backend services can be replicated behind a load balancer
- MongoDB can be set up as a replica set
- Redis can be configured in cluster mode
- Stateless design enables easy container orchestration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.