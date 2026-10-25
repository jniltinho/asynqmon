#
# First stage: 
# Building a frontend.
#

FROM node:24-bookworm-slim AS frontend

# Move to a working directory (/static).
WORKDIR /static

# Install the dependencies first (cached while package*.json do not change), then build into /static/build.
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui .
RUN npm run build

#
# Second stage: 
# Building a backend.
#

FROM golang:1.27-alpine AS backend

# Move to a working directory (/build).
WORKDIR /build

# Copy and download dependencies.
COPY go.mod go.sum ./
RUN go mod download

# Copy a source code to the container.
COPY . .

# Copy frontend static files from /static to the root folder of the backend container.
COPY --from=frontend ["/static/build", "ui/build"]

# Set necessary environmet variables needed for the image and build the server.
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64

# Run go build (with ldflags to reduce binary size).
RUN go build -ldflags="-s -w" -o asynqmon ./cmd/asynqmon

#
# Third stage: 
# Creating and running a new scratch container with the backend binary.
#

FROM scratch

# Copy binary from /build to the root folder of the scratch container.
COPY --from=backend ["/build/asynqmon", "/"]

# Command to run when starting the container.
ENTRYPOINT ["/asynqmon"]
