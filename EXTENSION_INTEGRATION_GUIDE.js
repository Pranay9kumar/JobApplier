// Extension Integration Guide: Application Tracking & Analytics
// ============================================================

// 1. RECORD APPLICATION (after user submits form)
// Location: extension/popup.js

async function recordApplicationAfterSubmit() {
  try {
    showToast('Recording application...', 'loading');

    // Get current job data from content script
    const jobData = await getJobDescription(); // Already implemented

    // Get match score if analyzed
    const scoreElement = document.getElementById('score');
    const matchScore = scoreElement
      ? parseInt(scoreElement.getAttribute('data-score'))
      : null;

    // Get user notes from optional field (add to popup)
    const notesField = document.getElementById('applicationNotes');
    const notes = notesField ? notesField.value : '';

    // Prepare application record
    const applicationData = {
      jobSnapshot: {
        title: jobData.title || 'Unknown Position',
        company: jobData.company || 'Unknown Company',
        location: jobData.location || '',
        description: jobData.description || '',
        source: 'extension',
      },
      matchScore: matchScore,
      matchedSkills: currentAnalysis?.matchedSkills || [],
      missingSkills: currentAnalysis?.missingSkills || [],
      notes: notes || null,
    };

    // Send to backend
    const response = await fetch(`${apiBase}/api/ai/record-application`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(applicationData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to record application');
    }

    const result = await response.json();

    showToast('✓ Application recorded! Track your status later.', 'success');
    
    // Optional: Show suggested next action
    if (result.suggestedActions) {
      console.log('Next actions:', result.suggestedActions);
    }

    return result.data;
  } catch (error) {
    console.error('Error recording application:', error);
    showToast('Failed to record application', 'error');
  }
}

// Add to popup.html after the action buttons:
// <div id="applicationNotes" placeholder="Optional: Notes about this application" 
//      style="display:none; margin:8px 0; padding:8px; border:1px solid #ddd; 
//             border-radius:4px; font-size:12px;"></div>

// ============================================================
// 2. UPDATE APPLICATION STATUS (after interview or rejection)
// Location: extension/popup.js or new dedicated UI component

async function updateApplicationStatus(applicationId, newStatus, notes = '') {
  try {
    showToast(`Updating status to ${newStatus}...`, 'loading');

    const response = await fetch(`${apiBase}/api/applications/${applicationId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: newStatus, // 'applied', 'interviewing', 'rejected', 'offer', 'accepted'
        notes: notes,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update status');
    }

    const result = await response.json();

    showToast(`✓ Status updated to ${newStatus}`, 'success');

    return result.data;
  } catch (error) {
    console.error('Error updating application:', error);
    showToast('Failed to update status', 'error');
  }
}

// Usage examples:
// updateApplicationStatus('507f1f77bcf86cd799439012', 'interviewing', 'Round 1 on Jan 20');
// updateApplicationStatus('507f1f77bcf86cd799439012', 'rejected', 'Not a good fit');
// updateApplicationStatus('507f1f77bcf86cd799439012', 'offer', 'Salary $150k/year');

// ============================================================
// 3. VIEW ANALYTICS DASHBOARD
// Location: extension/popup.js (new button/view)

async function viewAnalytics() {
  try {
    showToast('Loading analytics...', 'loading');

    // Show analytics panel (hide current content)
    const analysisPanel = document.getElementById('analysisPanel');
    const analyticsPanel = document.getElementById('analyticsPanel') || createAnalyticsPanel();
    
    if (analysisPanel) analysisPanel.style.display = 'none';
    analyticsPanel.style.display = 'block';

    // Fetch dashboard data
    const response = await fetch(`${apiBase}/api/analytics/dashboard`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to load analytics');

    const result = await response.json();
    displayAnalyticsDashboard(result.data);
    showToast('✓ Analytics loaded', 'success');
  } catch (error) {
    console.error('Error loading analytics:', error);
    showToast('Failed to load analytics', 'error');
  }
}

function createAnalyticsPanel() {
  const panel = document.createElement('div');
  panel.id = 'analyticsPanel';
  panel.style.cssText = `
    display: none;
    padding: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    color: white;
    overflow-y: auto;
    max-height: 500px;
  `;
  document.getElementById('popup').appendChild(panel);
  return panel;
}

function displayAnalyticsDashboard(data) {
  const panel = document.getElementById('analyticsPanel');
  
  const html = `
    <div style="margin-bottom: 16px;">
      <button onclick="goBackToAnalysis()" 
              style="padding: 8px 12px; background: rgba(255,255,255,0.2); 
                     border: 1px solid white; color: white; border-radius: 4px; cursor: pointer;">
        ← Back
      </button>
    </div>

    <h3 style="margin: 0 0 12px 0;">Job Search Analytics</h3>

    <!-- Summary Stats -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
      <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
        <div style="font-size: 10px; opacity: 0.8;">Total Applications</div>
        <div style="font-size: 24px; font-weight: bold;">${data.summary.totalApplications}</div>
      </div>
      <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
        <div style="font-size: 10px; opacity: 0.8;">This Week</div>
        <div style="font-size: 24px; font-weight: bold;">${data.summary.thisWeek}</div>
      </div>
      <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
        <div style="font-size: 10px; opacity: 0.8;">Interview Rate</div>
        <div style="font-size: 24px; font-weight: bold;">${data.summary.interviewRate}%</div>
      </div>
      <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
        <div style="font-size: 10px; opacity: 0.8;">Offer Rate</div>
        <div style="font-size: 24px; font-weight: bold;">${data.summary.conversionRate}%</div>
      </div>
    </div>

    <!-- Application Funnel -->
    <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
      <div style="font-size: 12px; margin-bottom: 8px; font-weight: bold;">Application Funnel</div>
      <div style="font-size: 11px; margin: 4px 0;">Applied: ${data.funnel.applications}</div>
      <div style="font-size: 11px; margin: 4px 0; opacity: 0.9;">→ Interviewing: ${data.funnel.interviewing}</div>
      <div style="font-size: 11px; margin: 4px 0; opacity: 0.8;">→ Offers: ${data.funnel.offers}</div>
      <div style="font-size: 11px; margin: 4px 0; opacity: 0.7;">→ Accepted: ${data.funnel.accepted}</div>
    </div>

    <!-- Top Missing Skills -->
    ${data.topMissingSkills.length > 0 ? `
      <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
        <div style="font-size: 12px; margin-bottom: 8px; font-weight: bold;">Top Missing Skills</div>
        ${data.topMissingSkills.map(skill => `
          <div style="font-size: 11px; margin: 4px 0;">• ${skill.skill} (${skill.count} jobs)</div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Recent Applications -->
    ${data.recentApplications.length > 0 ? `
      <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
        <div style="font-size: 12px; margin-bottom: 8px; font-weight: bold;">Recent Applications</div>
        ${data.recentApplications.map(app => `
          <div style="font-size: 10px; margin: 6px 0; padding: 6px; background: rgba(0,0,0,0.2); 
                      border-radius: 4px;">
            <div><strong>${app.title}</strong> @ ${app.company}</div>
            <div style="opacity: 0.8;">Status: ${app.status}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Insights -->
    ${data.insights.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 12px; margin-bottom: 8px; font-weight: bold;">💡 Insights</div>
        ${data.insights.map(insight => `
          <div style="font-size: 10px; margin: 4px 0; padding: 6px; 
                      background: ${
                        insight.level === 'positive' ? 'rgba(76, 175, 80, 0.2)' :
                        insight.level === 'warning' ? 'rgba(255, 193, 7, 0.2)' :
                        'rgba(100, 149, 237, 0.2)'
                      };
                      border-radius: 4px;">
            ${insight.message}
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  panel.innerHTML = html;
}

function goBackToAnalysis() {
  document.getElementById('analyticsPanel').style.display = 'none';
  document.getElementById('analysisPanel').style.display = 'block';
}

// Add button to popup.html:
// <button id="viewAnalyticsBtn" style="flex: 1; padding: 8px; background: #667eea; 
//         color: white; border: none; border-radius: 4px; cursor: pointer;">
//   📊 Analytics
// </button>
//
// In popup.js:
// document.getElementById('viewAnalyticsBtn')?.addEventListener('click', viewAnalytics);

// ============================================================
// 4. KEYBOARD SHORTCUTS
// Add to existing keyboard shortcut handler in popup.js

document.addEventListener('keydown', (e) => {
  if (e.altKey) {
    switch (e.key.toUpperCase()) {
      case 'A':
        e.preventDefault();
        handleAnalyze(); // Already implemented
        break;
      case 'P':
        e.preventDefault();
        handlePrepare(); // Already implemented
        break;
      case 'S':
        e.preventDefault();
        recordApplicationAfterSubmit(); // New: Record submission
        break;
      case 'T':
        e.preventDefault();
        showApplicationStatusUpdateModal(); // New: Update status
        break;
      case 'D':
        e.preventDefault();
        viewAnalytics(); // New: View dashboard
        break;
    }
  }
});

// ============================================================
// 5. APPLICATION STATUS UPDATE MODAL
// New UI component in popup.html

function showApplicationStatusUpdateModal() {
  // Create modal if not exists
  let modal = document.getElementById('statusUpdateModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'statusUpdateModal';
    modal.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                  background: rgba(0,0,0,0.5); display: flex; align-items: center; 
                  justify-content: center; z-index: 10000;">
        <div style="background: white; padding: 20px; border-radius: 8px; 
                    min-width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 12px 0;">Update Application Status</h3>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; margin-bottom: 4px;">Status</label>
            <select id="statusSelect" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="rejected">Rejected</option>
              <option value="offer">Offer Received</option>
              <option value="accepted">Accepted</option>
            </select>
          </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; margin-bottom: 4px;">Notes (optional)</label>
            <textarea id="statusNotes" placeholder="e.g., Scheduled for Jan 20" 
                      style="width: 100%; padding: 8px; border: 1px solid #ddd; 
                             border-radius: 4px; min-height: 60px;"></textarea>
          </div>

          <div style="display: flex; gap: 8px;">
            <button onclick="closeStatusModal()" 
                    style="flex: 1; padding: 8px; background: #eee; border: none; border-radius: 4px; cursor: pointer;">
              Cancel
            </button>
            <button onclick="submitStatusUpdate()" 
                    style="flex: 1; padding: 8px; background: #667eea; color: white; 
                           border: none; border-radius: 4px; cursor: pointer;">
              Update
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  modal.style.display = 'flex';
}

function closeStatusModal() {
  const modal = document.getElementById('statusUpdateModal');
  if (modal) modal.style.display = 'none';
}

async function submitStatusUpdate() {
  const status = document.getElementById('statusSelect').value;
  const notes = document.getElementById('statusNotes').value;
  
  // TODO: Get applicationId from current context
  // This should be set when user views application details
  
  // For now, prompt user to select application first
  alert('Select an application first');
}

// ============================================================
// 6. STORAGE & CONTEXT
// Add to popup.js initialization

// Store current application context for status updates
let currentApplicationContext = {
  id: null,
  title: null,
  company: null,
};

// When analyzing a job, store the ID for later reference
function setCurrentApplicationContext(applicationId, title, company) {
  currentApplicationContext = { id: applicationId, title, company };
}

// ============================================================
// TESTING CHECKLIST
// ============================================================

/*
✓ Test Application Recording:
  1. Analyze a job
  2. Submit application manually
  3. Call recordApplicationAfterSubmit()
  4. Verify: Application appears in backend database
  5. Check: Application has correct jobSnapshot, match data, notes

✓ Test Status Updates:
  1. Get applicationId from recorded application
  2. Call updateApplicationStatus(id, 'interviewing', 'Round 1 on Jan 20')
  3. Verify: Status changed in database
  4. Verify: statusUpdatedAt updated to current time

✓ Test Analytics:
  1. Record 5-10 applications with different statuses
  2. Call viewAnalytics()
  3. Verify: Dashboard shows correct metrics
  4. Verify: Funnel shows progression (applications → interviews → offers)
  5. Verify: Missing skills ranked by frequency

✓ Test Keyboard Shortcuts:
  - Alt+S: Record application
  - Alt+T: Update status
  - Alt+D: View analytics

✓ Error Handling:
  - Test with invalid token: Should show auth error
  - Test with non-existent applicationId: Should show 404
  - Test with invalid status: Should show validation error
*/
