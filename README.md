# Developer Onboarding System

This project is an automated developer onboarding workflow system built with Bun, TypeScript, Hono, and BullMQ. It manages a multi-step onboarding process, ensuring each stage is executed, tracked, and handled with proper error recovery.

## Tech Stack

- Runtime: Bun
- Language: TypeScript
- API Framework: Hono
- Task Queue: BullMQ (Redis-backed)
- Database: PostgreSQL
- Functional Programming: Effect
- Monitoring: Bull Board

## Project Structure

- `src/api`: Hono API server definitions and endpoints.
- `src/database`: Connection management, migrations, and schema definitions.
- `src/handlers`: Logic for tracking workflow progress and step statuses.
- `src/jobs`: Implementation of the individual onboarding steps.
- `src/libs`: Shared types and error definitions.
- `src/queue`: Queue and worker configurations.
- `index.ts`: Workflow definition and job enqueuing entry point.
- `server.ts`: Main server entry point (API + Bull Board UI).
- `worker.ts`: Background worker entry point.

## Onboarding Workflow

The system executes a sequential 10-step workflow for every new developer:

1. create-account: Initializes the developer account record.
2. generate-api-keys: Creates and hashes sandbox API keys.
3. create-sandbox: Provisions a dedicated sandbox environment.
4. seed-sandbox-data: Populates the sandbox with initial test data.
5. send-api-email: Sends API credentials to the developer.
6. create-postman: Generates a Postman collection for the developer.
7. rate-limiting: Sets up API rate limiting rules.
8. register-webhooks: Configures default webhook endpoints.
9. send-sandbox-email: Notifies the developer that their sandbox is ready.
10. notify-sales: Alerts the sales team of a new developer onboarding.

## Getting Started

### Prerequisites

- Bun runtime installed
- PostgreSQL database
- Redis server

### Configuration

Set the following environment variables:

- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgres://user:pass@localhost:5432/dbname`)
- `REDIS_HOST`: Redis server host (default: `localhost`)
- `REDIS_PORT`: Redis server port (default: `6379`)

### Installation

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables (refer to `.env.example` if available).

3. Run database migrations:
   ```bash
   bun run db:migrate
   ```

### Running the Application

- To start the API server and Bull Board UI:
  ```bash
   bun run server.ts
  ```
  The server will be available at http://localhost:3000 and the UI at http://localhost:3000/ui.

- To start the background worker:
  ```bash
   bun run worker.ts
  ```

## API Endpoints

### POST /onboard
Starts the onboarding process for a new developer.

Request Body:
```json
{
  "email": "developer@example.com",
  "companyName": "Example Corp"
}
```

Response (202 Accepted):
```json
{
  "status": "accepted",
  "jobId": "1",
  "workflowId": "uuid",
  "message": "Onboarding started, you will receive an email shortly"
}
```

## Database Schema

The system uses several tables to manage the onboarding process:

- workflows: Tracks the overall state and progress of an onboarding session.
- workflow_steps: Logs the status, attempts, and errors for each individual step.
- api_keys: Stores hashed API keys associated with a workflow.
- sandbox_environments: Manages configuration for provisioned sandboxes.
- rate_limit_rules: Stores defined rate limits for the developer.
- webhook_endpoints: Records registered webhook configurations.
- email_logs: Tracks all emails sent during the onboarding process.

## Error Handling

The system utilizes the Effect library for robust error handling and task composition. Each step in the workflow is tracked, and failures are logged in the `workflow_steps` table. BullMQ handles job retries and backoff strategies.
