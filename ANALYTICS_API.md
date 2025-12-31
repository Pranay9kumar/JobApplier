# Application Tracking & Analytics API

## Overview

The Application Tracking & Analytics system tracks job applications submitted through the extension and provides user-facing insights about job search performance, skill gaps, and conversion metrics.

## Data Model: Application Schema

```javascript
{
  user: ObjectId (ref: User),                    // User who applied
  job: ObjectId (ref: Job),                      // Job applied for
  jobSnapshot: {
    title: String,                               // Job title at time of application
    company: String,
    location: String,
    description: String,
    source: String,                              // Source (extension, web, etc.)
  },
  appliedAt: Date (default: now, indexed),       // When application was submitted
  status: String (enum: applied|interviewing|rejected|offer|accepted),
  statusUpdatedAt: Date,                         // When status changed
  notes: String (max 2000 chars),                // User notes about application
  resumeVersionUsed: ObjectId,                   // Resume version used for this application
  aiMatched: Boolean,                            // Was this job AI-matched?
  matchScoreSnapshot: Number,                    // AI match score at time of application
  matchedSkills: [String],                       // Skills that matched
  missingSkills: [String],                       // Skills missing from resume
  timestamps: { createdAt, updatedAt }           // Audit trail
}
```

## API Endpoints

### 1. Record Application
**POST /api/ai/record-application**

Records that a user has applied to a job. Called after autofill + manual submission.

**Request:**
```json
{
  "jobId": "507f1f77bcf86cd799439011",  // Optional: ref to existing job
  "jobSnapshot": {
    "title": "Senior Software Engineer",
    "company": "Acme Corp",
    "location": "San Francisco, CA",
    "description": "Looking for 5+ years experience...",
    "source": "extension"
  },
  "matchScore": 78,                      // Optional: AI match score
  "matchedSkills": ["React", "Node.js", "TypeScript"],
  "missingSkills": ["Kubernetes", "AWS"],
  "notes": "Great company, fully remote"  // Optional
}
```

**Response (201 Created):**
```json
{
  "type": "application",
  "message": "Application recorded",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "status": "applied",
    "appliedAt": "2024-01-15T10:30:00.000Z",
    "matchScore": 78,
    "nextAction": "Monitor for interviews and update status"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "suggestedActions": [
    {
      "action": "update-status",
      "description": "Mark as interviewed or rejected when you hear back"
    },
    {
      "action": "view-analytics",
      "description": "Check your application analytics"
    }
  ]
}
```

---

### 2. Update Application Status
**PUT /api/applications/:id**

Update application status as user receives feedback (interview, offer, rejection, etc.).

**Request:**
```json
{
  "status": "interviewing",                     // One of: applied, interviewing, rejected, offer, accepted
  "notes": "First round interview scheduled for Jan 20"  // Optional
}
```

**Response:**
```json
{
  "type": "application",
  "message": "Application status updated",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "status": "interviewing",
    "statusUpdatedAt": "2024-01-16T14:00:00.000Z",
    "notes": "First round interview scheduled for Jan 20",
    "nextAction": "Prepare for interview"
  },
  "timestamp": "2024-01-16T14:00:00.000Z"
}
```

---

### 3. Applications by Week
**GET /api/analytics/applications-by-week?weeks=12**

Returns applications grouped by week with interview conversion rates.

**Query Parameters:**
- `weeks` (optional, default 12): Number of weeks to analyze

**Response:**
```json
{
  "type": "analytics",
  "message": "Applications by week",
  "data": {
    "weeks": [
      {
        "week": "2024-W01",
        "dateStart": "2024-01-01",
        "applications": 5,
        "interviews": 1,
        "interviewRate": "20.0"
      },
      {
        "week": "2024-W02",
        "dateStart": "2024-01-08",
        "applications": 3,
        "interviews": 1,
        "interviewRate": "33.3"
      }
    ],
    "summary": {
      "totalApplications": 8,
      "totalInterviews": 2,
      "overallInterviewRate": "25.0",
      "trend": -2,                    // Change from previous week
      "trendDirection": "down",       // up|down|flat
      "averagePerWeek": "4.0"
    },
    "insights": [
      {
        "level": "info",
        "message": "Application pace slowed. Consider increasing applications this week."
      },
      {
        "level": "positive",
        "message": "Your interview rate is 25% - this is excellent!"
      }
    ]
  },
  "timestamp": "2024-01-16T15:00:00.000Z"
}
```

---

### 4. Conversion Metrics
**GET /api/analytics/conversion-metrics**

Returns application funnel: applied → interviewing → offers → accepted. Key metric for understanding resume quality.

**Response:**
```json
{
  "type": "analytics",
  "message": "Conversion metrics",
  "data": {
    "funnel": {
      "applications": 25,            // Total applications
      "interviewing": 4,             // Got interviews
      "offers": 2,                   // Received offers
      "accepted": 1                  // Accepted offer
    },
    "rates": {
      "conversionToOffer": "8.0",    // (offers + accepted) / total
      "conversionToInterview": "16.0"  // (interviewing + offers + accepted) / total
    },
    "distribution": {
      "applied": 18,                 // Still pending
      "interviewing": 4,
      "rejected": 3,
      "offers": 2,
      "accepted": 1                  // Account may have finished job search
    },
    "insights": [
      {
        "level": "positive",
        "message": "Excellent! Your offer rate (8.0%) is above average."
      },
      {
        "level": "positive",
        "message": "Strong interview rate (16.0%)! Focus on offer negotiation."
      }
    ]
  },
  "timestamp": "2024-01-16T15:00:00.000Z"
}
```

**Benchmarks (typical for mid-level roles):**
- Interview Rate: 10-20% (your rate indicates strong resume/cover letter)
- Offer Rate: 3-8% (competitive market dependent)
- Rejection Rate: 50-70% (most rejections at screen stage are normal)

---

### 5. Missing Skills Analysis
**GET /api/analytics/missing-skills?limit=10**

Returns most frequently missing skills across all applied jobs. Helps identify resume gaps to close.

**Query Parameters:**
- `limit` (optional, default 10): Number of top skills to return

**Response:**
```json
{
  "type": "analytics",
  "message": "Most missing skills",
  "data": {
    "skills": [
      {
        "skill": "Kubernetes",
        "frequency": 12,              // How many jobs required this?
        "percentageOfJobs": "48.0",   // Percent of all applications
        "exampleJobs": [
          "Senior DevOps Engineer at TechCorp",
          "Platform Engineer at StartupXYZ"
        ]
      },
      {
        "skill": "AWS",
        "frequency": 9,
        "percentageOfJobs": "36.0",
        "exampleJobs": [
          "Backend Engineer at CloudInc"
        ]
      },
      {
        "skill": "Python",
        "frequency": 7,
        "percentageOfJobs": "28.0",
        "exampleJobs": [
          "Data Engineer at DataCorp"
        ]
      }
    ],
    "summary": {
      "totalApplicationsAnalyzed": 25,
      "topSkill": "Kubernetes",
      "topSkillFrequency": 12,
      "averageSkillsPerJob": "2.3"    // How many missing skills per job on average
    },
    "insights": [
      {
        "level": "warning",
        "message": "Kubernetes is missing from 48% of jobs. Consider upskilling here."
      },
      {
        "level": "info",
        "message": "Your skill gaps vary widely. Focus on the top skill first."
      }
    ]
  },
  "timestamp": "2024-01-16T15:00:00.000Z"
}
```

---

### 6. Analytics Dashboard
**GET /api/analytics/dashboard**

Comprehensive view combining all metrics for a dashboard UI.

**Response:**
```json
{
  "type": "analytics",
  "message": "Dashboard overview",
  "data": {
    "summary": {
      "totalApplications": 25,
      "thisWeek": 3,                 // Applications submitted this week
      "conversionRate": "8.0",       // To offers
      "interviewRate": "16.0"        // To interviews
    },
    "funnel": {
      "applications": 25,
      "interviewing": 4,
      "offers": 2,
      "accepted": 1
    },
    "topMissingSkills": [
      { "skill": "Kubernetes", "count": 12 },
      { "skill": "AWS", "count": 9 },
      { "skill": "Python", "count": 7 }
    ],
    "recentApplications": [
      {
        "id": "507f1f77bcf86cd799439012",
        "title": "Senior Software Engineer",
        "company": "Acme Corp",
        "status": "applied",
        "appliedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "insights": [
      {
        "level": "positive",
        "message": "You're on pace! 3 applications this week."
      },
      {
        "level": "suggestion",
        "message": "Most jobs need Kubernetes. Upskilling here could boost your match rate."
      }
    ]
  },
  "timestamp": "2024-01-16T15:00:00.000Z"
}
```

---

## Integration in Extension

### Recording Applications (popup.js)

After user clicks "Submit" on a job application:

```javascript
// After successful manual submission
const recordApplication = async () => {
  const response = await fetch(`${apiBase}/api/ai/record-application`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jobSnapshot: {
        title: currentJob.title,
        company: currentJob.company,
        location: currentJob.location,
        description: currentJob.description,
      },
      matchScore: parseInt(scoreElement.getAttribute('data-score')),
      matchedSkills: currentJob.matchedSkills,
      missingSkills: currentJob.missingSkills,
      notes: userNotes
    })
  });
  
  showToast('Application recorded successfully', 'success');
};
```

### Viewing Analytics

Add button to popup that opens analytics dashboard:

```javascript
const viewAnalytics = async () => {
  const response = await fetch(`${apiBase}/api/analytics/dashboard`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const analytics = await response.json();
  displayAnalyticsDashboard(analytics.data);
};
```

---

## Authentication

All analytics endpoints require valid JWT token:
- **Header**: `Authorization: Bearer <accessToken>`
- **Token Types**: `web` or `extension`
- **Expiry**: 7 days (refresh tokens valid 30 days)

---

## Error Responses

**401 Unauthorized** - Missing or invalid token
```json
{
  "success": false,
  "error": {
    "message": "Missing or invalid token",
    "code": "MISSING_TOKEN",
    "requestId": "req-abc123",
    "timestamp": "2024-01-16T15:00:00.000Z"
  }
}
```

**403 Forbidden** - Application belongs to another user
```json
{
  "success": false,
  "error": {
    "message": "Unauthorized: application belongs to another user",
    "code": "FORBIDDEN",
    "requestId": "req-abc123",
    "timestamp": "2024-01-16T15:00:00.000Z"
  }
}
```

**404 Not Found** - Application not found
```json
{
  "success": false,
  "error": {
    "message": "Application not found",
    "code": "NOT_FOUND",
    "requestId": "req-abc123",
    "timestamp": "2024-01-16T15:00:00.000Z"
  }
}
```

**400 Bad Request** - Invalid input
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "status": "Invalid status value"
    },
    "requestId": "req-abc123",
    "timestamp": "2024-01-16T15:00:00.000Z"
  }
}
```

---

## Rate Limiting

Analytics endpoints share the general rate limit:
- **200 requests per minute per IP**
- **Response Header**: `Retry-After` (seconds) if rate limited
- **Status**: `429 Too Many Requests`

---

## User-Facing Insights

### Applications by Week
- **Insight**: "Great! You increased applications by 2 this week." (Positive trend)
- **Insight**: "Application pace slowed. Consider increasing applications this week." (Negative trend)
- **Insight**: "Your interview rate is 25% - this is excellent!" (High interview rate)

### Conversion Metrics
- **Insight**: "Excellent! Your offer rate (8%) is above average." (Strong performance)
- **Insight**: "Low offer rate. Review your resume and cover letter approach." (Needs improvement)
- **Insight**: "Many rejections at screen stage. Consider refining your resume targeting."

### Missing Skills
- **Insight**: "Kubernetes is missing from 48% of jobs. Consider upskilling here."
- **Insight**: "Your skill gaps vary widely. Focus on the top skill first."

---

## Next Steps

1. **Extension UI**: Add "View Analytics" button in popup
2. **Status Updates**: Prompt user to update application status after interviews
3. **Export**: Allow users to export analytics as CSV for external tracking
4. **Notifications**: Remind users to update status after ~2 weeks (common first response time)
5. **Goal Setting**: Let users set targets (e.g., "3 applications/week", "10% interview rate")
