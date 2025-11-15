#!/bin/bash

################################################################################
# HestiaCP API Test Script
# Otestuje připojení k HestiaCP API
################################################################################

# Load configuration
if [ -f ".env.deploy" ]; then
    source .env.deploy
else
    echo "❌ Chybí .env.deploy soubor!"
    echo "Vytvoř .env.deploy podle .env.deploy.example"
    exit 1
fi

echo "================================================"
echo "  HestiaCP API Connection Test"
echo "================================================"
echo ""
echo "Testing connection to: ${HESTIA_URL}"
echo "User: ${HESTIA_USER}"
echo ""

# Test 1: Basic connectivity
echo "Test 1: Checking if HestiaCP server is reachable..."
if curl -k -s --connect-timeout 10 "${HESTIA_URL}" > /dev/null; then
    echo "✅ Server is reachable"
else
    echo "❌ Cannot reach server at ${HESTIA_URL}"
    echo "   Check SERVER_IP and firewall settings"
    exit 1
fi

# Test 2: API authentication
echo ""
echo "Test 2: Testing API authentication..."
response=$(curl -k -s -X POST "${HESTIA_URL}/api/" \
    -d "hash=${HESTIA_ACCESS_KEY_ID}:${HESTIA_SECRET_ACCESS_KEY}" \
    -d "returncode=yes" \
    -d "cmd=v-list-users")

if [[ "$response" == *"${HESTIA_USER}"* ]] || [[ "$response" == "0" ]]; then
    echo "✅ API authentication successful"
else
    echo "❌ API authentication failed"
    echo "   Response: ${response}"
    echo "   Check your ACCESS_KEY_ID and SECRET_ACCESS_KEY"
    exit 1
fi

# Test 3: List web domains
echo ""
echo "Test 3: Listing existing web domains..."
response=$(curl -k -s -X POST "${HESTIA_URL}/api/" \
    -d "hash=${HESTIA_ACCESS_KEY_ID}:${HESTIA_SECRET_ACCESS_KEY}" \
    -d "returncode=yes" \
    -d "cmd=v-list-web-domains" \
    -d "arg1=${HESTIA_USER}" \
    -d "arg2=json")

if [ $? -eq 0 ]; then
    echo "✅ Successfully retrieved web domains"
    echo ""
    echo "Existing domains:"
    echo "${response}" | jq -r 'keys[]' 2>/dev/null || echo "${response}"
else
    echo "⚠️  Could not list domains (this is OK if you have no domains yet)"
fi

# Test 4: Check if target domain exists
if [ -n "${DOMAIN}" ]; then
    echo ""
    echo "Test 4: Checking if domain '${DOMAIN}' exists..."
    response=$(curl -k -s -X POST "${HESTIA_URL}/api/" \
        -d "hash=${HESTIA_ACCESS_KEY_ID}:${HESTIA_SECRET_ACCESS_KEY}" \
        -d "returncode=yes" \
        -d "cmd=v-list-web-domain" \
        -d "arg1=${HESTIA_USER}" \
        -d "arg2=${DOMAIN}")

    if [[ "$response" != "" ]] && [[ "$response" != *"Error"* ]]; then
        echo "✅ Domain ${DOMAIN} exists"
    else
        echo "ℹ️  Domain ${DOMAIN} doesn't exist yet (will be created during deployment)"
    fi
fi

# Summary
echo ""
echo "================================================"
echo "  Test Results Summary"
echo "================================================"
echo "✅ HestiaCP server is reachable"
echo "✅ API authentication works"
echo "✅ API commands are responding"
echo ""
echo "🎉 You're ready to deploy!"
echo ""
echo "Next step: Run ./deploy-hestia.sh"
echo "================================================"
