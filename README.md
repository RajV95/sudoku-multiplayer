# Sudoku Multiplayer Speedrun

A premium, highly interactive, multiplayer Sudoku speedrun application. Players compete in real-time on identical boards to see who solves it first.

Developed with ♥ by [Rajvardhan](https://github.com/RajV95).

---

## Key Features (SRS)

- **Real-Time Board Sync**: Players solve identical generated Sudoku boards. Progress percentages (0–100%) are calculated dynamically and broadcasted in real-time.
- **Synchronized Match Timer**: Matches share a synchronized clock starting from the game-start timestamp.
- **Forfeit Limit (Max Mistakes)**: Room hosts can enforce a mistake limit (e.g., 3 or 5). Players who exceed the limit are eliminated, and their competitor wins.
- **Game Room Live Chat**: High-performance in-game chat allows real-time text matches.
- **Chess-like Interface Layout**: 
  - 3-column desktop layout (Board, Keypad/Controls, Progress/Chat).
  - Premium light theme inspired by Chess.com and Sudoku.com.
  - Interactive highlights: active focus, related axes, and matching number value highlights across the board.
- **Session Kick Rules**: Prevents cheating by ensuring only one active socket connection per user ID. Logging in on a second device automatically disconnects the first.
- **60-Second Reconnection Grace Period**: If a player loses connection, they have 60 seconds to reconnect or change devices before auto-forfeiting.

---

## Tech Stack

- **Framework**: Next.js (App Router)
- **Real-Time Networking**: Socket.IO & Node.js Custom Server
- **State Store & Pub/Sub**: Redis (Session data, room states, cache)
- **Primary Database**: MongoDB & Mongoose (Persistent User accounts, credentials, and match history logs)
- **Testing**: Vitest (Unit and integration suites)
- **Deployment**: Docker & k3s (Kubernetes manifests)

---

## Local Development Setup

### 1. Prerequisites
Ensure you have Node.js (v18+) and Docker installed.

### 2. Boot Local Databases
Start Redis and MongoDB via Docker Compose:
```bash
docker compose up -d
```

### 3. Install Dependencies & Build
Install npm modules:
```bash
npm install
```

### 4. Run the Application
Launch the dev server running ts-node Socket.IO middleware:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

### 5. Running Tests
Run the Vitest integration suite:
```bash
npm run test
```

---

## Deployment with k3s

The application is equipped with production Kubernetes manifests located in the `/k3s` directory.

### Local Kubernetes Setup (using k3d)
1. **Create Cluster**:
   ```bash
   k3d cluster create sudoku-cluster -p "8080:80@loadbalancer"
   ```
2. **Build and Import Docker Image**:
   ```bash
   docker build -t sudoku-multiplayer:latest .
   k3d image import sudoku-multiplayer:latest -c sudoku-cluster
   ```
3. **Apply Manifests**:
   ```bash
   kubectl apply -f k3s/mongodb.yaml
   kubectl apply -f k3s/redis.yaml
   kubectl apply -f k3s/app-deployment.yaml
   kubectl apply -f k3s/ingress.yaml
   ```
4. **Access locally**: Add `127.0.0.1 sudoku.local` to your hosts file and navigate to `http://sudoku.local:8080`.

### Production VPS Deployment
1. **Install k3s on VPS**:
   ```bash
   curl -sfL https://get.k3s.io | sh -
   ```
2. **Registry Push**: Build and push the application image to Docker Hub (e.g. `docker push yourusername/sudoku-multiplayer:latest`).
3. **Configure & Deploy**: Update `image` path in `k3s/app-deployment.yaml` and run `kubectl apply -f k3s/`.
