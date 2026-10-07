/**
 * Phase 8 Comprehensive Runtime Verification Test
 * Tests the live backend at http://localhost:5000 and PostgreSQL database.
 */
const http = require('http');
const { Client } = require('pg');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : null;
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const results = [];
function record(testName, passed, details = '') {
  results.push({ test: testName, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING PHASE 8 RUNTIME VERIFICATION');
  console.log('====================================================\n');

  // DB client setup
  const dbClient = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'jira_clone_db',
  });
  await dbClient.connect();

  const timestamp = Date.now();
  const adminEmail = `admin_${timestamp}@test.com`;
  const devEmail = `dev_${timestamp}@test.com`;
  const viewerEmail = `viewer_${timestamp}@test.com`;
  const password = 'Password123!';

  // --- 0. AUTHENTICATION & SETUP ---
  console.log('--- Setting up Test Users ---');
  await request('POST', '/auth/register', { email: adminEmail, password, fullName: 'Test Admin' });
  await request('POST', '/auth/register', { email: devEmail, password, fullName: 'Test Dev' });
  await request('POST', '/auth/register', { email: viewerEmail, password, fullName: 'Test Viewer' });

  const adminLogin = await request('POST', '/auth/login', { email: adminEmail, password });
  const adminToken = adminLogin.body.accessToken;

  const devLogin = await request('POST', '/auth/login', { email: devEmail, password });
  const devToken = devLogin.body.accessToken;

  const viewerLogin = await request('POST', '/auth/login', { email: viewerEmail, password });
  const viewerToken = viewerLogin.body.accessToken;

  // Get user IDs
  const adminUserRes = await dbClient.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  const adminUserId = adminUserRes.rows[0].id;
  const devUserRes = await dbClient.query('SELECT id FROM users WHERE email = $1', [devEmail]);
  const devUserId = devUserRes.rows[0].id;
  const viewerUserRes = await dbClient.query('SELECT id FROM users WHERE email = $1', [viewerEmail]);
  const viewerUserId = viewerUserRes.rows[0].id;

  // Create Project A (admin owner)
  const projARes = await request('POST', '/projects', {
    name: `Project A ${timestamp}`,
    key: `PA${timestamp.toString().slice(-4)}`,
    description: 'Test Project A',
  }, adminToken);
  const projectAId = projARes.body.id;

  // Add Dev and Viewer to Project A
  await request('POST', `/projects/${projectAId}/members`, { userId: devUserId, role: 'DEVELOPER' }, adminToken);
  await request('POST', `/projects/${projectAId}/members`, { userId: viewerUserId, role: 'VIEWER' }, adminToken);

  // Create Project B (for cross-project security check)
  const projBRes = await request('POST', '/projects', {
    name: `Project B ${timestamp}`,
    key: `PB${timestamp.toString().slice(-4)}`,
    description: 'Test Project B',
  }, adminToken);
  const projectBId = projBRes.body.id;

  // ==================================================
  // 4. SPRINT CREATION TEST
  // ==================================================
  console.log('\n--- 4. SPRINT CREATION TEST ---');
  const sprintCreateRes = await request('POST', `/projects/${projectAId}/sprints`, {
    name: 'Sprint Verification Test',
    goal: 'Testing Phase 8',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
  }, adminToken);

  const sprintCreated = sprintCreateRes.body;
  const is201 = sprintCreateRes.status === 201;
  const hasPlannedStatus = sprintCreated?.status === 'PLANNED';
  const hasCorrectProject = sprintCreated?.projectId === projectAId;
  const hasDates = !!sprintCreated?.startDate && !!sprintCreated?.endDate;

  record('Sprint creation (HTTP 201, PLANNED, projectId, dates)', is201 && hasPlannedStatus && hasCorrectProject && hasDates, `status: ${sprintCreateRes.status}`);

  // DB persistence check
  const dbSprint1 = await dbClient.query('SELECT * FROM sprints WHERE id = $1', [sprintCreated.id]);
  record('Sprint persistence after creation in DB', dbSprint1.rows.length === 1 && dbSprint1.rows[0].name === 'Sprint Verification Test');

  // ==================================================
  // 3. BACKEND API VERIFICATION (Endpoints)
  // ==================================================
  console.log('\n--- 3. BACKEND API VERIFICATION ---');
  // GET /projects/:projectId/sprints
  const listSprintsRes = await request('GET', `/projects/${projectAId}/sprints`, null, adminToken);
  record('GET /projects/:projectId/sprints', listSprintsRes.status === 200 && Array.isArray(listSprintsRes.body) && listSprintsRes.body.length >= 1);

  // GET /sprints/:id
  const getSprintRes = await request('GET', `/sprints/${sprintCreated.id}`, null, adminToken);
  record('GET /sprints/:id', getSprintRes.status === 200 && getSprintRes.body.id === sprintCreated.id);

  // PATCH /sprints/:id
  const patchSprintRes = await request('PATCH', `/sprints/${sprintCreated.id}`, { name: 'Sprint Verification Test Updated' }, adminToken);
  record('PATCH /sprints/:id', patchSprintRes.status === 200 && patchSprintRes.body.name === 'Sprint Verification Test Updated', `status: ${patchSprintRes.status}, body: ${JSON.stringify(patchSprintRes.body)}`);

  // ==================================================
  // 5. RBAC TEST (ADMIN, DEVELOPER, VIEWER)
  // ==================================================
  console.log('\n--- 5. RBAC TEST ---');
  // Developer: View ✅, Create ❌ (403), Edit ❌ (403), Start ❌ (403), Complete ❌ (403), Delete ❌ (403)
  const devListRes = await request('GET', `/projects/${projectAId}/sprints`, null, devToken);
  record('DEVELOPER can view sprints (200)', devListRes.status === 200);

  const devCreateRes = await request('POST', `/projects/${projectAId}/sprints`, { name: 'Dev Sprint' }, devToken);
  record('DEVELOPER cannot create sprint (403)', devCreateRes.status === 403, `got ${devCreateRes.status}`);

  const devEditRes = await request('PATCH', `/sprints/${sprintCreated.id}`, { name: 'Dev Edit' }, devToken);
  record('DEVELOPER cannot edit sprint (403)', devEditRes.status === 403, `got ${devEditRes.status}`);

  const devStartRes = await request('POST', `/sprints/${sprintCreated.id}/start`, null, devToken);
  record('DEVELOPER cannot start sprint (403)', devStartRes.status === 403, `got ${devStartRes.status}`);

  const devCompleteRes = await request('POST', `/sprints/${sprintCreated.id}/complete`, null, devToken);
  record('DEVELOPER cannot complete sprint (403)', devCompleteRes.status === 403, `got ${devCompleteRes.status}`);

  const devDeleteRes = await request('DELETE', `/sprints/${sprintCreated.id}`, null, devToken);
  record('DEVELOPER cannot delete sprint (403)', devDeleteRes.status === 403, `got ${devDeleteRes.status}`);

  // Viewer: View ✅, Mutations ❌ (403)
  const viewerListRes = await request('GET', `/projects/${projectAId}/sprints`, null, viewerToken);
  record('VIEWER can view sprints (200)', viewerListRes.status === 200);

  const viewerCreateRes = await request('POST', `/projects/${projectAId}/sprints`, { name: 'Viewer Sprint' }, viewerToken);
  record('VIEWER cannot create sprint (403)', viewerCreateRes.status === 403, `got ${viewerCreateRes.status}`);

  const viewerStartRes = await request('POST', `/sprints/${sprintCreated.id}/start`, null, viewerToken);
  record('VIEWER cannot start sprint (403)', viewerStartRes.status === 403, `got ${viewerStartRes.status}`);

  const viewerDeleteRes = await request('DELETE', `/sprints/${sprintCreated.id}`, null, viewerToken);
  record('VIEWER cannot delete sprint (403)', viewerDeleteRes.status === 403, `got ${viewerDeleteRes.status}`);

  // ==================================================
  // 6. ACTIVE SPRINT TEST
  // ==================================================
  console.log('\n--- 6. ACTIVE SPRINT TEST ---');
  // Admin starts planned sprint
  const startSprintRes = await request('POST', `/sprints/${sprintCreated.id}/start`, null, adminToken);
  const isStart200 = startSprintRes.status === 200;
  const statusActive = startSprintRes.body?.status === 'ACTIVE';
  const startDatePopulated = !!startSprintRes.body?.startDate;
  record('Start planned sprint (status -> ACTIVE, startDate populated)', isStart200 && statusActive && startDatePopulated);

  // Attempt to start the same sprint again -> 400
  const startAgainRes = await request('POST', `/sprints/${sprintCreated.id}/start`, null, adminToken);
  record('Attempt to start already active sprint (400)', startAgainRes.status === 400, `got ${startAgainRes.status}`);

  // Create another planned sprint
  const secondSprintRes = await request('POST', `/projects/${projectAId}/sprints`, {
    name: 'Second Planned Sprint',
  }, adminToken);
  const secondSprintId = secondSprintRes.body.id;

  // Attempt to start second sprint while first is ACTIVE -> 400
  const startSecondRes = await request('POST', `/sprints/${secondSprintId}/start`, null, adminToken);
  record('Cannot start second sprint while one is ACTIVE (400)', startSecondRes.status === 400, `got ${startSecondRes.status}`);

  // Confirm only one active sprint in project
  const activeSprintsInDb = await dbClient.query(
    "SELECT * FROM sprints WHERE \"projectId\" = $1 AND status = 'ACTIVE'",
    [projectAId]
  );
  record('Only one ACTIVE sprint exists for project in DB', activeSprintsInDb.rows.length === 1);

  // ==================================================
  // 7. BACKLOG TEST
  // ==================================================
  console.log('\n--- 7. BACKLOG TEST ---');
  const issueARes = await request('POST', `/projects/${projectAId}/issues`, { title: 'Issue A' }, adminToken);
  const issueBRes = await request('POST', `/projects/${projectAId}/issues`, { title: 'Issue B' }, adminToken);
  const issueCRes = await request('POST', `/projects/${projectAId}/issues`, { title: 'Issue C' }, adminToken);

  const issueA = issueARes.body;
  const issueB = issueBRes.body;
  const issueC = issueCRes.body;

  record('Issues A, B, C created with sprintId = null', !issueA.sprintId && !issueB.sprintId && !issueC.sprintId);

  // GET /projects/:projectId/sprints/backlog
  const backlogRes = await request('GET', `/projects/${projectAId}/sprints/backlog`, null, adminToken);
  const backlogIds = backlogRes.body.map(i => i.id);
  const allInBacklog = backlogIds.includes(issueA.id) && backlogIds.includes(issueB.id) && backlogIds.includes(issueC.id);
  record('Backlog endpoint returns all 3 unassigned issues', backlogRes.status === 200 && allInBacklog);

  // ==================================================
  // 8. ASSIGN ISSUE TO SPRINT
  // ==================================================
  console.log('\n--- 8. ASSIGN ISSUE TO SPRINT ---');
  const assignIssueARes = await request('PATCH', `/issues/${issueA.id}/sprint`, { sprintId: sprintCreated.id }, adminToken);
  record('PATCH /issues/:id/sprint returns success (200)', assignIssueARes.status === 200 && assignIssueARes.body.sprintId === sprintCreated.id);

  // Check backlog: Issue A should disappear from backlog
  const backlogAfterAssign = await request('GET', `/projects/${projectAId}/sprints/backlog`, null, adminToken);
  const backlogAfterIds = backlogAfterAssign.body.map(i => i.id);
  record('Issue A disappears from Backlog', !backlogAfterIds.includes(issueA.id));

  // Check Issue details: Issue A has sprintId = sprint.id
  const getIssueARes = await request('GET', `/issues/${issueA.id}`, null, adminToken);
  record('Issue A appears in selected Sprint', getIssueARes.body.sprintId === sprintCreated.id);

  // Also verify Developer can assign issue to sprint
  const devAssignIssueB = await request('PATCH', `/issues/${issueB.id}/sprint`, { sprintId: sprintCreated.id }, devToken);
  record('DEVELOPER can assign issue to sprint (200)', devAssignIssueB.status === 200);

  // And Viewer cannot assign issue to sprint
  const viewerAssignIssueC = await request('PATCH', `/issues/${issueC.id}/sprint`, { sprintId: sprintCreated.id }, viewerToken);
  record('VIEWER cannot assign issue to sprint (403)', viewerAssignIssueC.status === 403);

  // Assign issue C as admin for subsequent tests
  await request('PATCH', `/issues/${issueC.id}/sprint`, { sprintId: sprintCreated.id }, adminToken);

  // ==================================================
  // 9. REMOVE ISSUE FROM SPRINT (Back to Backlog)
  // ==================================================
  console.log('\n--- 9. REMOVE ISSUE FROM SPRINT ---');
  const removeIssueARes = await request('PATCH', `/issues/${issueA.id}/sprint`, { sprintId: null }, adminToken);
  record('PATCH /issues/:id/sprint with null returns success', removeIssueARes.status === 200 && removeIssueARes.body.sprintId === null);

  const backlogAfterRemove = await request('GET', `/projects/${projectAId}/sprints/backlog`, null, adminToken);
  const backlogRemoveIds = backlogAfterRemove.body.map(i => i.id);
  record('Issue A appears in Backlog again', backlogRemoveIds.includes(issueA.id));

  // Re-assign Issue A back to sprint for Completion test
  await request('PATCH', `/issues/${issueA.id}/sprint`, { sprintId: sprintCreated.id }, adminToken);

  // ==================================================
  // 10. CROSS-PROJECT SECURITY TEST
  // ==================================================
  console.log('\n--- 10. CROSS-PROJECT SECURITY TEST ---');
  // Create sprint in Project B
  const sprintBRes = await request('POST', `/projects/${projectBId}/sprints`, { name: 'Sprint in Project B' }, adminToken);
  const sprintBId = sprintBRes.body.id;

  // Attempt to assign Issue A (from Project A) to Sprint in Project B
  const crossAssignRes = await request('PATCH', `/issues/${issueA.id}/sprint`, { sprintId: sprintBId }, adminToken);
  record('Cross-project issue/sprint assignment is rejected (400)', crossAssignRes.status === 400, `got ${crossAssignRes.status}`);

  // ==================================================
  // 12. KANBAN INTEGRATION & STATUS TRANSITIONS
  // ==================================================
  console.log('\n--- 12. KANBAN INTEGRATION ---');
  // Issue A: TODO -> IN_PROGRESS -> DONE
  const toInProgress = await request('PATCH', `/issues/${issueA.id}/status`, { status: 'IN_PROGRESS' }, adminToken);
  record('Issue transition TODO -> IN_PROGRESS', toInProgress.status === 200 && toInProgress.body.status === 'IN_PROGRESS');

  const toDone = await request('PATCH', `/issues/${issueA.id}/status`, { status: 'DONE' }, adminToken);
  record('Issue transition IN_PROGRESS -> DONE', toDone.status === 200 && toDone.body.status === 'DONE');

  // Issue B: set to TODO (already TODO)
  // Issue C: set to IN_PROGRESS
  await request('PATCH', `/issues/${issueC.id}/status`, { status: 'IN_PROGRESS' }, adminToken);

  // Test reversible DONE -> IN_PROGRESS
  const backToInProgress = await request('PATCH', `/issues/${issueA.id}/status`, { status: 'IN_PROGRESS' }, adminToken);
  const backToDoneAgain = await request('PATCH', `/issues/${issueA.id}/status`, { status: 'DONE' }, adminToken);
  record('Status transition DONE -> IN_PROGRESS -> DONE works', backToInProgress.status === 200 && backToDoneAgain.status === 200);

  // ==================================================
  // 14. SPRINT ANALYTICS TEST
  // ==================================================
  console.log('\n--- 14. SPRINT ANALYTICS TEST ---');
  // Sprint has 3 issues: Issue A (DONE), Issue B (TODO), Issue C (IN_PROGRESS)
  const sprintWithAnalytics = await request('GET', `/sprints/${sprintCreated.id}`, null, adminToken);
  const totalCount = sprintWithAnalytics.body.issueCount;
  const doneCount = sprintWithAnalytics.body.completedIssueCount;
  const completionPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  record('Sprint analytics: Total = 3, Done = 1', totalCount === 3 && doneCount === 1, `Total: ${totalCount}, Done: ${doneCount}`);
  record('Sprint analytics: Completion % ~33.33%', Math.abs(completionPct - 33.33) < 0.5, `got ${completionPct.toFixed(2)}%`);

  // ==================================================
  // 13. SPRINT COMPLETION TEST
  // ==================================================
  console.log('\n--- 13. SPRINT COMPLETION TEST ---');
  const completeRes = await request('POST', `/sprints/${sprintCreated.id}/complete`, null, adminToken);
  record('POST /sprints/:id/complete returns success (200)', completeRes.status === 200);
  record('movedToBacklogCount = 2 (Issue B and Issue C moved to backlog)', completeRes.body.movedToBacklogCount === 2, `got ${completeRes.body.movedToBacklogCount}`);

  // DB verification of issue sprintIds after completion
  const dbIssueA = await dbClient.query('SELECT * FROM issues WHERE id = $1', [issueA.id]);
  const dbIssueB = await dbClient.query('SELECT * FROM issues WHERE id = $1', [issueB.id]);
  const dbIssueC = await dbClient.query('SELECT * FROM issues WHERE id = $1', [issueC.id]);

  record('DONE issue (Issue A) remains associated with completed sprint', dbIssueA.rows[0].sprintId === sprintCreated.id);
  record('TODO issue (Issue B) sprintId reset to null (backlog)', dbIssueB.rows[0].sprintId === null);
  record('IN_PROGRESS issue (Issue C) sprintId reset to null (backlog)', dbIssueC.rows[0].sprintId === null);

  // ==================================================
  // 11. COMPLETED SPRINT PROTECTION
  // ==================================================
  console.log('\n--- 11. COMPLETED SPRINT PROTECTION ---');
  // Attempt to assign issue to completed sprint -> 400
  const assignToCompleted = await request('PATCH', `/issues/${issueB.id}/sprint`, { sprintId: sprintCreated.id }, adminToken);
  record('Cannot assign issue to completed sprint (400)', assignToCompleted.status === 400, `got ${assignToCompleted.status}`);

  // Attempt to start completed sprint -> 400
  const startCompleted = await request('POST', `/sprints/${sprintCreated.id}/start`, null, adminToken);
  record('Cannot start completed sprint (400)', startCompleted.status === 400, `got ${startCompleted.status}`);

  // Attempt to edit completed sprint -> 400
  const editCompleted = await request('PATCH', `/sprints/${sprintCreated.id}`, { name: 'Rename Completed' }, adminToken);
  record('Cannot modify completed sprint (400)', editCompleted.status === 400, `got ${editCompleted.status}`);

  // Attempt to delete completed sprint -> 400
  const deleteCompleted = await request('DELETE', `/sprints/${sprintCreated.id}`, null, adminToken);
  record('Cannot delete completed sprint (400)', deleteCompleted.status === 400, `got ${deleteCompleted.status}`);

  // Delete PLANNED sprint (secondSprintId) should succeed
  const deletePlanned = await request('DELETE', `/sprints/${secondSprintId}`, null, adminToken);
  record('ADMIN can delete PLANNED sprint (200)', deletePlanned.status === 200);

  // ==================================================
  // 15. ACTIVITY TIMELINE TEST
  // ==================================================
  console.log('\n--- 15. ACTIVITY TIMELINE TEST ---');
  const activityRows = await dbClient.query(
    'SELECT "actionType", "issueId", "userId", "oldValue", "newValue", "createdAt" FROM activity_logs WHERE "userId" = $1 ORDER BY "createdAt" ASC',
    [adminUserId]
  );
  const actionTypes = activityRows.rows.map(r => r.actionType);

  record('Activity log contains SPRINT_CREATED', actionTypes.includes('SPRINT_CREATED'));
  record('Activity log contains SPRINT_STARTED', actionTypes.includes('SPRINT_STARTED'));
  record('Activity log contains SPRINT_COMPLETED', actionTypes.includes('SPRINT_COMPLETED'));
  record('Activity log contains ISSUE_ADDED_TO_SPRINT', actionTypes.includes('ISSUE_ADDED_TO_SPRINT'));
  record('Activity log contains ISSUE_REMOVED_FROM_SPRINT', actionTypes.includes('ISSUE_REMOVED_FROM_SPRINT'));
  record('Activity log contains ISSUE_CREATED', actionTypes.includes('ISSUE_CREATED'));
  record('Activity log contains STATUS_CHANGED', actionTypes.includes('STATUS_CHANGED'));

  // Verify activity endpoint
  const issueActivityRes = await request('GET', `/issues/${issueA.id}/activity`, null, adminToken);
  record('GET /issues/:id/activity returns activity with actor details', issueActivityRes.status === 200 && Array.isArray(issueActivityRes.body) && issueActivityRes.body.length > 0 && !!issueActivityRes.body[0].actor.fullName);

  // ==================================================
  // 20. REGRESSION TESTS (Comments, Issue Delete, etc.)
  // ==================================================
  console.log('\n--- 20. REGRESSION TESTS ---');
  // Comments CRUD
  const commentAddRes = await request('POST', `/issues/${issueA.id}/comments`, { content: 'Test comment' }, adminToken);
  const commentId = commentAddRes.body?.id;
  record('Add comment to issue (201/200)', [200, 201].includes(commentAddRes.status) && !!commentId);

  const commentEditRes = await request('PATCH', `/comments/${commentId}`, { content: 'Updated comment' }, adminToken);
  record('Edit comment (200)', commentEditRes.status === 200);

  const commentDeleteRes = await request('DELETE', `/comments/${commentId}`, null, adminToken);
  record('Delete comment (200)', commentDeleteRes.status === 200);

  // Issue deletion by Project Admin
  const tempIssue = await request('POST', `/projects/${projectAId}/issues`, { title: 'Temp Issue for deletion' }, adminToken);
  const deleteIssueRes = await request('DELETE', `/issues/${tempIssue.body.id}`, null, adminToken);
  record('Delete issue by Admin (200)', deleteIssueRes.status === 200);

  // Clean up DB client
  await dbClient.end();

  // Summary
  console.log('\n====================================================');
  console.log('PHASE 8 RUNTIME VERIFICATION SUMMARY');
  console.log('====================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total tests: ${total}`);
  console.log(`PASS: ${passed}`);
  console.log(`FAIL: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => console.log(` - ${r.test}: ${r.details}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL RUNTIME VERIFICATION TESTS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
