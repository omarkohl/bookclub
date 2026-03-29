# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1-alpine AS backend
ENV GOTOOLCHAIN=auto
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/frontend/dist ./internal/handler/frontend/
RUN CGO_ENABLED=0 go build -o bookclub ./cmd/bookclub

# Stage 3: Runtime
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=backend /app/bookclub /usr/local/bin/bookclub
EXPOSE 8080
ENTRYPOINT ["bookclub"]
