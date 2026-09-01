# IA Admin Adjunta - CI/CD & AI Bot Ecosystem Setup Guide

## 🚀 Project Overview

**ia-admin-adjunta** is a production-ready Admin Dashboard with:
- Supabase Edge Functions
- Rate Limiting
- Real-time Monitoring
- AI-powered Automation
- Gemini AI Integration
- Chrome Extension Support

---

## 📋 Workflow Files Created

### 1. **CI Pipeline** (`.github/workflows/ci-pipeline.yml`)
Automated testing, code quality checks, and building:
- ✅ ESLint code quality scanning
- ✅ Prettier formatting checks
- ✅ Security audits (npm audit)
- ✅ Unit tests (Node 16, 18, 20)
- ✅ Integration tests
- ✅ Docker image building
- ✅ AI-powered code analysis on PRs

**Triggers:** Push, Pull Request, Manual

---

### 2. **Deployment Pipeline** (`.github/workflows/deployment.yml`)
Automated deployments to staging and production:
- ✅ Environment detection (staging/production)
- ✅ Docker image building and pushing
- ✅ Staging deployment with smoke tests
- ✅ Production deployment with validation tests
- ✅ GitHub release creation
- ✅ Post-deployment health checks

**Triggers:** Push to main, Version tags, Manual

---

### 3. **AI Bot Error Handler** (`.github/workflows/ai-bot-error-handler.yml`)
Autonomous error detection and correction:
- ✅ Workflow failure analysis
- ✅ Error pattern recognition
- ✅ Automatic fix suggestions
- ✅ Knowledge base updates
- ✅ Recurring error detection

**Triggers:** Issues, Workflow runs, Scheduled (hourly)

---

### 4. **Gemini AI Integration** (`.github/workflows/gemini-ai-integration.yml`)
Google Gemini AI + Chrome Extension support:
- ✅ Gemini API synchronization
- ✅ AI documentation generation
- ✅ Chrome Extension building
- ✅ Extension manifest validation
- ✅ Content moderation with Gemini
- ✅ Chrome Web Store integration

**Triggers:** Schedule (6 hours), Manual, Path changes

---

### 5. **AI Bot Ecosystem** (`.github/workflows/ai-bot-ecosystem.yml`)
Sales, lead generation, and business intelligence:
- ✅ Market analysis and lead scoring
- ✅ Sales content generation
- ✅ Target market identification
- ✅ Error event response
- ✅ Performance monitoring
- ✅ Automatic GitHub issue creation for sales opportunities

**Triggers:** Scheduled (weekdays 9 AM), Manual

---

### 6. **Supabase Integration** (`.github/workflows/supabase-integration.yml`)
Database and real-time monitoring:
- ✅ Database migrations
- ✅ Supabase function testing
- ✅ Real-time subscription testing
- ✅ Edge function testing
- ✅ Production deployment

**Triggers:** Push, Pull Request, Manual

---

## 🔐 Required Secrets

Add these to your GitHub repository secrets (`Settings > Secrets and variables > Actions`):

### Core Secrets:
```
GITHUB_TOKEN              # Auto-generated, no action needed
AWS_ROLE_ARN_STAGING      # AWS IAM role for staging deployment
AWS_ROLE_ARN_PRODUCTION   # AWS IAM role for production deployment
```

### Gemini & AI Secrets:
```
GEMINI_API_KEY            # Google Gemini AI API key
CHROME_EXTENSION_ID       # Chrome Web Store extension ID
CHROME_CLIENT_ID          # Chrome Web Store client ID
CHROME_CLIENT_SECRET      # Chrome Web Store client secret
CHROME_REFRESH_TOKEN      # Chrome Web Store refresh token
```

### Supabase Secrets:
```
SUPABASE_ACCESS_TOKEN     # Supabase project access token
SUPABASE_PROJECT_ID       # Your Supabase project ID
```

### Optional Integrations:
```
SLACK_WEBHOOK             # Slack notifications for deployments
```

---

## 📊 Workflow Features

### Code Quality & Testing
```yaml
- Linting with ESLint
- Format checking with Prettier
- Security audits
- Multi-version Node testing (16, 18, 20)
- Coverage reporting
- Docker image building
```

### Deployment Strategy
```yaml
Environment Detection:
  - Tags (v*.*.*)  → Production
  - Main branch    → Staging
  - Manual trigger → Configurable (staging/production)

Deployment Flow:
  1. Pre-deployment checks
  2. Build & push Docker image
  3. Deploy to environment
  4. Run validation tests
  5. Health checks & monitoring
```

### AI Bot Capabilities

#### Error Handling
- Detects workflow failures automatically
- Analyzes error patterns
- Generates auto-fix suggestions
- Learns from recurring errors
- Creates fix PRs automatically

#### Lead Generation
- Analyzes target markets
- Identifies key decision makers
- Generates sales content
- Creates GitHub issues for opportunities
- Scores leads by potential

#### Chrome Extension Integration
- Builds extension automatically
- Validates manifests
- Deploys to Chrome Web Store
- Generates documentation
- Supports Gemini AI features

---

## 🔗 Integration Points

### Gemini AI Integration
```javascript
// Automatically syncs with Google Gemini API
// Generates documentation
// Powers content moderation
// Provides intelligent code analysis

Configuration:
- Model: gemini-2.0-flash
- Context: ia-admin-adjunta-production
- Key: GEMINI_API_KEY (environment variable)
```

### Chrome Extension Features
```javascript
- Seamless browser integration
- Gemini AI-powered features
- Admin dashboard shortcuts
- Real-time notifications
- Rate limiting indicator
- System monitoring display
```

### Supabase Integration
```javascript
- Automatic migrations
- Edge function testing
- Real-time subscription validation
- Database health checks
- Automatic production deployment
```

---

## 🎯 Business Features

### Sales & Lead Generation
Automated workflow for:
1. **Market Analysis**: AI identifies high-value segments
2. **Lead Scoring**: Prioritizes by potential ROI
3. **Content Generation**: Creates targeted sales materials
4. **Issue Creation**: Auto-creates actionable tasks
5. **Performance Tracking**: Weekly metrics reports

### Target Markets
1. **Small-Mid SaaS Companies**
   - Deal size: $15K-$50K
   - Pain point: Admin overhead
   - Decision maker: CTO/VP Engineering

2. **Enterprise Companies**
   - Deal size: $100K+
   - Pain point: Complex workflows
   - Decision maker: CIO/Enterprise Architect

3. **Agencies**
   - Deal size: $10K-$30K
   - Pain point: Client management
   - Decision maker: Operations Director

---

## 📈 Monitoring & Observability

### Health Checks
- Application endpoint validation
- Deployment status notifications
- Performance metrics collection
- Error rate tracking
- Uptime monitoring

### Reporting
- Weekly performance reports
- Error pattern analysis
- Deployment metrics
- AI bot effectiveness
- Sales pipeline updates

---

## 🚦 Getting Started

### Step 1: Setup GitHub Secrets
1. Go to: `Repository → Settings → Secrets and variables → Actions`
2. Add all required secrets (see above)
3. Verify each secret is properly configured

### Step 2: Enable Workflows
1. Go to: `Actions` tab
2. Enable workflow runs if needed
3. Workflows will trigger on:
   - Push events
   - Pull requests
   - Scheduled times
   - Manual dispatch

### Step 3: Configure Branch Protection
```yaml
Branch: main
Rules:
  - Require status checks to pass
  - Require code reviews
  - Allow auto-merge
  - Dismiss stale reviews
```

### Step 4: Setup Environments
```yaml
Environments:
  - staging
    - URL: https://staging.ia-admin-adjunta.com
    - Required reviewers: Optional
  
  - production
    - URL: https://ia-admin-adjunta.com
    - Required reviewers: Required (1+)
```

---

## 🔍 Monitoring & Debugging

### View Workflow Runs
1. Go to: `Actions` tab
2. Select workflow
3. View detailed logs
4. Check artifact uploads

### Common Issues & Solutions

**Issue**: Workflows not triggering
- **Solution**: Check branch protection rules, verify secrets exist

**Issue**: Deployment failing
- **Solution**: Verify AWS credentials, check Docker registry access

**Issue**: Tests failing
- **Solution**: Check Node version compatibility, verify dependencies

**Issue**: AI features not working
- **Solution**: Verify GEMINI_API_KEY is set, check API quota

---

## 📚 Documentation

### Workflow Documentation
- Each workflow has detailed comments
- Job descriptions explain purpose
- Step names are self-documenting

### Chrome Extension Docs
- Generated at: `docs/CHROME_EXTENSION.md`
- Auto-updated on each build
- Includes feature list and installation steps

### API Documentation
- Generated via Gemini AI
- Located at: `docs/generated/`
- Auto-updated on schedule

---

## 🎓 Advanced Usage

### Custom Triggers
```yaml
# Manual workflow dispatch
workflow_dispatch:
  inputs:
    environment:
      description: 'Target environment'
      type: choice
      options:
        - staging
        - production
```

### Matrix Testing
```yaml
# Test across multiple Node versions
matrix:
  node-version: [16.x, 18.x, 20.x]
```

### Conditional Jobs
```yaml
# Only run on main branch
if: github.ref == 'refs/heads/main'

# Only run on failure
if: github.event.workflow_run.conclusion == 'failure'
```

---

## 📝 Notes

- All workflows run in isolation
- Artifacts retained for 7-30 days depending on type
- AI bot learns from patterns over time
- Gemini API has rate limits (check quota)
- Chrome extension uploads require credentials
- Supabase deployments are automatic on main branch

---

## 📞 Support

For issues or questions:
1. Check workflow logs in Actions tab
2. Review error artifacts
3. Check GitHub Issues for similar problems
4. Refer to official GitHub Actions documentation

---

**Last Updated**: September 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
