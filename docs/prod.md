# Production Deployment

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 1.29+ (or equivalent)
- 1GB+ free disk space (for Chrome, dependencies, and output)
- Access to Dokploy network for Dokploy deployments (optional)

## Docker Build

### Build the image

```bash
docker build -t pdf-reporter-mcp:latest .
```

The multi-stage Dockerfile:
1. **Builder stage:** Compiles TypeScript to JavaScript, installs all dependencies
2. **Runtime stage:** Minimal Node.js 20-slim image with only production deps + Chrome

### Image details

- **Size:** ~600MB (slim base + Chrome dependencies)
- **Base image:** `node:20-slim`
- **Chrome:** System chromium (not bundled)
- **Environment:** Production-optimized

## Docker Run

### Standalone container (stdio transport)

```bash
docker run --rm \
  --name pdf-reporter \
  -v pdf-output:/app/output \
  pdf-reporter-mcp:latest
```

Expected output:
```
PDF Reporter MCP server started on stdio
```

Server communicates via stdin/stdout. Use with MCP clients that support stdio transport (Claude Desktop, custom integration).

### Docker Compose (SSE transport + Dokploy)

```bash
docker compose up -d
```

Starts the server on port 3000 with SSE transport. Environment:
- `TRANSPORT=sse` — HTTP transport (default in compose)
- `PORT=3000` — Server port
- `NODE_ENV=production` — Production mode
- `THEME_PRIMARY_COLOR` — Customize accent color (optional)
- `THEME_COVER_COLOR` — Customize cover color (optional)

Access the MCP server at `http://pdf-reporter-mcp:3000/sse` from other containers on the dokploy-network.

### Port mapping

```bash
docker run -p 3000:3000 \
  -v pdf-output:/app/output \
  pdf-reporter-mcp:latest
```

Maps port 3000 to host. Server then available at `http://localhost:3000/sse`.

## Environment Variables

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `production` | Runtime environment (production/development) |
| `TRANSPORT` | `stdio` | Transport type: `stdio` or `sse` |
| `PORT` | `3000` | Server port (only for SSE transport) |
| `OUTPUT_DIR` | `/app/output` | Directory for generated PDFs |
| `TEMP_DIR` | `/app/temp` | Directory for temporary files |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | Path to Chrome binary |
| `THEME_PRIMARY_COLOR` | `#4169E1` | Accent color for headings, callouts, links |
| `THEME_COVER_COLOR` | Same as primary | Cover page background color |

### Setting variables

Via `docker run`:
```bash
docker run -e NODE_ENV=production \
  -e PORT=8080 \
  -e OUTPUT_DIR=/output \
  -e THEME_PRIMARY_COLOR="#E81E63" \
  -e THEME_COVER_COLOR="#880E4F" \
  pdf-reporter-mcp:latest
```

Via `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - OUTPUT_DIR=/app/output
  - THEME_PRIMARY_COLOR=#4169E1
  - THEME_COVER_COLOR=#4169E1
```

Via `.env` file:
```bash
docker compose --env-file .env up -d
```

## Volumes

### Output volume (persistent PDFs)

```bash
docker run -v pdf-output:/app/output pdf-reporter-mcp:latest
```

PDFs generated in `/app/output` inside container. Mount as:
- **Named volume:** `-v pdf-output:/app/output` (managed by Docker)
- **Host path:** `-v /host/pdfs:/app/output` (bind mount)
- **Docker Compose:** Defined in `volumes:` section

### Temp volume (optional)

```bash
docker run -v pdf-temp:/app/temp pdf-reporter-mcp:latest
```

Temporary Mermaid files and intermediate content. Auto-cleaned. Can omit if disk I/O not a concern.

## MCP Client Configuration

### Claude Desktop (stdio transport)

1. Stop the server if running locally
2. Add to Claude Desktop config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pdf-reporter": {
      "command": "docker",
      "args": ["run", "--rm", "-v", "pdf-output:/app/output", "pdf-reporter-mcp:latest"]
    }
  }
}
```

3. Restart Claude Desktop
4. Ask Claude: "Generate a PDF report about X"

### Dokploy SSE transport

Deploy as docker-compose service (included in `docker-compose.yml`):

```yaml
services:
  pdf-reporter:
    build: .
    container_name: pdf-reporter-mcp
    environment:
      - TRANSPORT=sse
      - PORT=3000
      - THEME_PRIMARY_COLOR=#4169E1
      - THEME_COVER_COLOR=#4169E1
    networks:
      - dokploy-network
    volumes:
      - pdf-output:/app/output
```

Server available at `http://pdf-reporter-mcp:3000/sse` from other services on dokploy-network.

To customize theme colors, set environment variables before deploying:
```yaml
environment:
  - THEME_PRIMARY_COLOR=#E81E63
  - THEME_COVER_COLOR=#880E4F
```

To call from another container:

```bash
curl -X POST http://pdf-reporter-mcp:3000/sse/call \
  -H "Content-Type: application/json" \
  -d '{"method":"generate_pdf","params":{"title":"Report","content":"..."}}'
```

### Custom MCP client

For any MCP-compatible client:

**Stdio:**
```
command: docker
args: ["run", "--rm", "-v", "pdf-output:/app/output", "pdf-reporter-mcp:latest"]
```

**SSE:**
```
url: http://pdf-reporter-mcp:3000/sse
```

## Monitoring

### Logs

```bash
# Docker container logs
docker logs pdf-reporter-mcp

# Follow logs in real-time
docker logs -f pdf-reporter-mcp

# Docker Compose
docker compose logs pdf-reporter
docker compose logs -f pdf-reporter
```

### Health check

Verify server is running:

```bash
# Stdio transport (check process)
docker ps | grep pdf-reporter-mcp

# SSE transport (check port)
curl http://localhost:3000/sse
```

### Disk usage

Monitor output directory for disk growth:

```bash
# Named volume
docker exec pdf-reporter-mcp du -sh /app/output

# Host path
du -sh /host/pdfs

# Docker Compose
docker compose exec pdf-reporter du -sh /app/output
```

### Resource limits

Set memory and CPU limits:

```bash
docker run --memory=512m --cpus=1 pdf-reporter-mcp:latest
```

In docker-compose.yml:
```yaml
services:
  pdf-reporter:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Troubleshooting

### Chrome crashes or memory errors

**Error:** `Chromium crashed` or `Out of memory`

**Solution:**
1. Increase container memory: `--memory=1g`
2. Check available host memory: `free -h`
3. Reduce concurrent requests (queue them)
4. Disable headless mode debugging: ensure `--headless=new` (default in Puppeteer 23.11.1)

**Prevention:** Minimum 512MB recommended, 1GB for production.

### Mermaid rendering fails

**Error:** `mmdc: command not found` or `Chrome launch failed`

**Solution:**
1. Rebuild image fresh: `docker build --no-cache -t pdf-reporter-mcp:latest .`
2. Verify Chrome is installed: `docker run -it pdf-reporter-mcp:latest chromium --version`
3. Check Dockerfile has all dependencies (lines 22-44)

### Permission errors in output directory

**Error:** `EACCES: permission denied, open '/app/output/...'`

**Solution:**
1. Check volume is mounted: `docker exec pdf-reporter-mcp ls -la /app/output`
2. Check permissions: `docker exec pdf-reporter-mcp ls -la /app/`
3. Recreate volume: `docker volume rm pdf-output && docker compose up -d`
4. Or use host path with correct permissions: `-v /host/pdfs:/app/output`

### SSE connection failures

**Error:** `Failed to connect to SSE endpoint`

**Solution:**
1. Check port mapping: `docker ps | grep pdf-reporter`
2. Test connectivity: `curl http://localhost:3000/sse`
3. Check firewall: `sudo ufw allow 3000` (Linux)
4. Verify compose network: `docker network ls | grep dokploy`

### PDF generation timeout

**Error:** `Puppeteer timeout` or `PDF generation took too long`

**Solution:**
1. Check system resources: `docker stats pdf-reporter-mcp`
2. Increase timeout in config (currently hardcoded to 30s, may need adjustment)
3. Break large documents into multiple PDF calls
4. Check Chrome process: `docker top pdf-reporter-mcp | grep chromium`

## Backup and Recovery

### Backup PDFs

```bash
# Copy from named volume to host
docker run --rm -v pdf-output:/data -v /host/backup:/backup \
  alpine cp -r /data /backup/pdf-output-$(date +%Y%m%d)

# Or tar directly
docker run --rm -v pdf-output:/data -v /host/backup:/backup \
  alpine tar -czf /backup/pdf-output-$(date +%Y%m%d).tar.gz /data
```

### Archive old PDFs

```bash
# Inside container, archive by date
docker exec pdf-reporter-mcp \
  find /app/output -mtime +30 -exec mv {} /app/archived/ \;
```

### Clean up output directory

```bash
# Remove all PDFs
docker exec pdf-reporter-mcp rm -f /app/output/*

# Or delete and recreate volume
docker compose down -v
docker compose up -d
```

## Updates and Maintenance

### Update to latest code

```bash
git pull origin main
docker build -t pdf-reporter-mcp:latest .
docker compose up -d
```

Container restarts automatically with new image.

### Zero-downtime update (with docker-compose)

```bash
docker compose pull  # Pull latest image
docker compose up -d # Restart with new image
```

### Rollback to previous version

```bash
docker build -t pdf-reporter-mcp:v1.0.0 .
docker run -v pdf-output:/app/output pdf-reporter-mcp:v1.0.0
```

Tag images by version for easy rollback.

## Performance Optimization

### Parallel PDF generation

The server can handle concurrent requests. For production scaling:

1. **Docker Compose:** Run multiple instances with load balancer
2. **Kubernetes:** Use HPA for auto-scaling
3. **Rate limiting:** Implement in upstream (Kong, nginx)

### Caching

- **Template caching:** Handlebars templates compiled once at startup
- **Font caching:** Chrome caches fonts in /tmp
- **No asset caching:** Each request is independent

### Benchmarks

- **Cold start (first PDF):** 2-3 seconds (Chrome startup)
- **Warm requests:** 1-2 seconds per PDF
- **Large documents (100+ pages):** 5-10 seconds
- **Memory per request:** 200-400MB
- **Disk per PDF:** varies with content, typically 0.5-5MB

## Security

### Input validation

All inputs validated with Zod schemas:
- `title` — required string
- `content` — required string (Markdown)
- `diagrams` — optional array of { name, mermaid }

Malicious content (XSS, script injection) is escaped in HTML templates.

### Chrome sandbox

Puppeteer runs Chrome in sandbox mode. Content is NOT executed, only rendered. Safe for untrusted input.

### Network access

- No outbound requests from PDF rendering
- No file system access outside /app/output and /app/temp
- Temp files auto-cleaned

### HTTPS in production

If exposing SSE transport over network:
1. Use reverse proxy (nginx, Traefik)
2. Terminate TLS at proxy
3. Server listens on HTTP only

Example nginx config:
```nginx
server {
  listen 443 ssl;
  server_name pdf.example.com;
  ssl_certificate /etc/ssl/cert.pem;
  ssl_certificate_key /etc/ssl/key.pem;

  location / {
    proxy_pass http://pdf-reporter-mcp:3000;
  }
}
```

## Support and Debugging

### Enable debug logging

```bash
docker run -e NODE_ENV=development pdf-reporter-mcp:latest
```

Adds verbose logging to console.

### Inspect container

```bash
# Open shell in running container
docker exec -it pdf-reporter-mcp-mcp sh

# Check installed dependencies
docker exec pdf-reporter-mcp npm ls

# Check Node version
docker exec pdf-reporter-mcp node --version
```

### Check compilation errors

```bash
# Rebuild with verbose output
docker build -t pdf-reporter-mcp:latest . --progress=plain

# Check dist files
docker exec pdf-reporter-mcp ls -la dist/
```

## References

- [Dockerfile specification](https://docs.docker.com/engine/reference/builder/)
- [Docker Compose specification](https://docs.docker.com/compose/compose-file/)
- [Puppeteer documentation](https://pptr.dev/)
- [Mermaid CLI documentation](https://mermaid.js.org/ecosystem/mermaid-cli/cli-usage.html)
- [Node.js Docker best practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
