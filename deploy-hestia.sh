#!/bin/bash

################################################################################
# HestiaCP Automatic Deployment Script
# Automaticky nasadí HostingVemice web na HestiaCP server
################################################################################

set -e  # Exit on error

# Load configuration
if [ -f ".env.deploy" ]; then
    source .env.deploy
else
    echo "❌ Chybí .env.deploy soubor!"
    echo "Vytvoř .env.deploy podle .env.deploy.example"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "  HestiaCP Deployment - HostingVemice"
echo "================================================"
echo ""

################################################################################
# Helper Functions
################################################################################

hestia_api() {
    local cmd=$1
    shift

    local url="${HESTIA_URL}/api/"

    echo "🔧 Running: v-${cmd}"

    # Build curl command with arguments as arg1, arg2, arg3, etc.
    local curl_cmd="curl -k -s -X POST \"${url}\""
    curl_cmd="$curl_cmd -d \"hash=${HESTIA_ACCESS_KEY_ID}:${HESTIA_SECRET_ACCESS_KEY}\""
    curl_cmd="$curl_cmd -d \"returncode=yes\""
    curl_cmd="$curl_cmd -d \"cmd=v-${cmd}\""

    # Add arguments as arg1, arg2, arg3, etc.
    local arg_num=1
    for arg in "$@"; do
        curl_cmd="$curl_cmd -d \"arg${arg_num}=${arg}\""
        arg_num=$((arg_num + 1))
    done

    # Execute curl command
    response=$(eval $curl_cmd)
    local exit_code=$?

    # Check response
    if [ $exit_code -eq 0 ]; then
        # HestiaCP returns 0 for success, non-zero for errors
        if [[ "$response" == "0" ]] || [[ "$response" == "" ]] || [[ "$response" == "OK"* ]]; then
            echo "✅ Success"
            return 0
        else
            # Check if it's an error code
            if [[ "$response" =~ ^[0-9]+$ ]] && [ "$response" -ne 0 ]; then
                echo "❌ API error code: ${response}"
                return 1
            else
                # Might be data response (like from list commands)
                echo "${response}"
                return 0
            fi
        fi
    else
        echo "❌ Curl failed with exit code: ${exit_code}"
        return 1
    fi
}

################################################################################
# Step 1: Check if domain exists
################################################################################

echo -e "${YELLOW}Step 1: Checking domain...${NC}"

# Check if web domain exists
# v-list-web-domain user domain
check_domain=$(hestia_api "list-web-domain" "${HESTIA_USER}" "${DOMAIN}" || echo "not_found")

if [[ "$check_domain" != "not_found" ]] && [[ "$check_domain" != *"Error"* ]]; then
    echo -e "${GREEN}✅ Domain ${DOMAIN} already exists${NC}"

    read -p "Delete and recreate? (y/n): " recreate
    if [[ "$recreate" == "y" ]]; then
        echo "🗑️  Deleting existing domain..."
        # v-delete-web-domain user domain
        hestia_api "delete-web-domain" "${HESTIA_USER}" "${DOMAIN}"
        sleep 2
        DOMAIN_EXISTS=false
    else
        DOMAIN_EXISTS=true
    fi
else
    echo "Domain doesn't exist, will create new one"
    DOMAIN_EXISTS=false
fi

################################################################################
# Step 2: Create web domain
################################################################################

if [ "$DOMAIN_EXISTS" = false ]; then
    echo -e "${YELLOW}Step 2: Creating web domain...${NC}"

    # v-add-web-domain user domain [ip] [restart]
    # Pokud SERVER_IP není nastavená, HestiaCP použije výchozí IP
    if [ -n "${SERVER_IP}" ]; then
        hestia_api "add-web-domain" "${HESTIA_USER}" "${DOMAIN}" "${SERVER_IP}" "yes"
    else
        hestia_api "add-web-domain" "${HESTIA_USER}" "${DOMAIN}"
    fi

    echo -e "${GREEN}✅ Domain created${NC}"
    sleep 2
else
    echo -e "${YELLOW}Step 2: Skipping domain creation${NC}"
fi

################################################################################
# Step 3: Upload files
################################################################################

echo -e "${YELLOW}Step 3: Building and uploading files...${NC}"

# Build frontend locally
echo "🔨 Building React app..."
npm install
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
tar -czf deploy.tar.gz \
    build/ \
    server.js \
    package.json \
    package-lock.json \
    .env \
    node_modules/ 2>/dev/null || tar -czf deploy.tar.gz \
    build/ \
    server.js \
    package.json \
    package-lock.json \
    .env

# Upload via SFTP/SCP
echo "📤 Uploading files to server..."
scp -P ${SSH_PORT:-22} deploy.tar.gz ${HESTIA_USER}@${SERVER_IP}:/home/${HESTIA_USER}/web/${DOMAIN}/

# Extract on server
echo "📂 Extracting files on server..."
ssh -p ${SSH_PORT:-22} ${HESTIA_USER}@${SERVER_IP} << EOF
cd /home/${HESTIA_USER}/web/${DOMAIN}/public_html
tar -xzf ../deploy.tar.gz
rm ../deploy.tar.gz

# Install backend dependencies if not uploaded
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install --production
fi

# Set correct permissions
chmod -R 755 build/
chmod 644 .env
EOF

# Clean up local package
rm deploy.tar.gz

echo -e "${GREEN}✅ Files uploaded${NC}"

################################################################################
# Step 4: Configure Nginx
################################################################################

echo -e "${YELLOW}Step 4: Configuring Nginx...${NC}"

# Create custom Nginx template
ssh -p ${SSH_PORT:-22} ${HESTIA_USER}@${SERVER_IP} "sudo tee /home/${HESTIA_USER}/web/${DOMAIN}/nginx.conf_override" > /dev/null << 'NGINX_EOF'
# React SPA routing
location / {
    root /home/HESTIA_USER/web/DOMAIN/public_html/build;
    try_files $uri $uri/ /index.html;
    index index.html;
}

# Backend API proxy
location /api {
    proxy_pass http://localhost:NODE_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# Health check
location /health {
    proxy_pass http://localhost:NODE_PORT;
    proxy_http_version 1.1;
}

# Static files caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    root /home/HESTIA_USER/web/DOMAIN/public_html/build;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
NGINX_EOF

# Replace placeholders
ssh -p ${SSH_PORT:-22} ${HESTIA_USER}@${SERVER_IP} << EOF
sudo sed -i "s|HESTIA_USER|${HESTIA_USER}|g" /home/${HESTIA_USER}/web/${DOMAIN}/nginx.conf_override
sudo sed -i "s|DOMAIN|${DOMAIN}|g" /home/${HESTIA_USER}/web/${DOMAIN}/nginx.conf_override
sudo sed -i "s|NODE_PORT|${NODE_PORT:-3001}|g" /home/${HESTIA_USER}/web/${DOMAIN}/nginx.conf_override
EOF

# Rebuild Nginx config
# v-rebuild-web-domain user domain [restart]
hestia_api "rebuild-web-domain" "${HESTIA_USER}" "${DOMAIN}" "yes"

echo -e "${GREEN}✅ Nginx configured${NC}"

################################################################################
# Step 5: Setup SSL (Let's Encrypt)
################################################################################

echo -e "${YELLOW}Step 5: Setting up SSL...${NC}"

# v-add-letsencrypt-domain user domain [aliases]
hestia_api "add-letsencrypt-domain" "${HESTIA_USER}" "${DOMAIN}" "www.${DOMAIN}" || echo "⚠️  SSL setup failed, maybe already exists"

echo -e "${GREEN}✅ SSL configured${NC}"

################################################################################
# Step 6: Start Node.js backend with PM2
################################################################################

echo -e "${YELLOW}Step 6: Starting Node.js backend...${NC}"

ssh -p ${SSH_PORT:-22} ${HESTIA_USER}@${SERVER_IP} << EOF
# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

cd /home/${HESTIA_USER}/web/${DOMAIN}/public_html

# Stop existing process
pm2 delete gopay-backend 2>/dev/null || true

# Start backend
pm2 start server.js --name "gopay-backend" --time

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup || true

echo "Backend started on port ${NODE_PORT:-3001}"
pm2 status
EOF

echo -e "${GREEN}✅ Backend started${NC}"

################################################################################
# Step 7: Update .env on server
################################################################################

echo -e "${YELLOW}Step 7: Updating production .env...${NC}"

ssh -p ${SSH_PORT:-22} ${HESTIA_USER}@${SERVER_IP} << EOF
cd /home/${HESTIA_USER}/web/${DOMAIN}/public_html

# Update .env with production values
cat > .env << 'ENVEOF'
SKIP_PREFLIGHT_CHECK=true
ESLINT_NO_DEV_ERRORS=true
TSC_COMPILE_ON_ERROR=true
FAST_REFRESH=false

# Supabase
REACT_APP_SUPABASE_URL=${SUPABASE_URL}
REACT_APP_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

# API Configuration - PRODUCTION
REACT_APP_API_URL=https://${DOMAIN}
SERVER_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
PORT=${NODE_PORT:-3001}

# GoPay - PRODUCTION
REACT_APP_GOPAY_GO_ID=${GOPAY_GO_ID}
REACT_APP_GOPAY_CLIENT_ID=${GOPAY_CLIENT_ID}
REACT_APP_GOPAY_CLIENT_SECRET=${GOPAY_CLIENT_SECRET}
REACT_APP_GOPAY_ENVIRONMENT=PRODUCTION
ENVEOF

# Restart backend to load new .env
pm2 restart gopay-backend
EOF

echo -e "${GREEN}✅ Environment updated${NC}"

################################################################################
# Done!
################################################################################

echo ""
echo "================================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "🌐 Frontend: https://${DOMAIN}"
echo "🔧 Backend: https://${DOMAIN}/health"
echo "📊 Logs: ssh ${HESTIA_USER}@${SERVER_IP} 'pm2 logs gopay-backend'"
echo ""
echo "Verify deployment:"
echo "  1. Visit https://${DOMAIN}"
echo "  2. Test health: curl https://${DOMAIN}/health"
echo "  3. Check backend: ssh ${HESTIA_USER}@${SERVER_IP} 'pm2 status'"
echo ""
echo "================================================"
