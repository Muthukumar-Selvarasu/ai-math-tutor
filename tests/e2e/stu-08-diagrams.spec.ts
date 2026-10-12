import { test, expect } from '@playwright/test';
import { validateDiagram, renderDiagram, DIAGRAM_ASSETS } from '../../lib/diagram-service';

test.describe('STU-08: Diagrams that help (Visual Model & Ratio Table)', () => {

  test('Criterion 1: Approved SVG diagram and text description appear when question requires diagram and hint level reaches Level 3+', async ({
    page,
  }) => {
    // Navigate to practice page (loads ratio_share_001 with has_diagram: true)
    await page.goto('/practice');

    // Level 0: Diagram is not yet shown (min_level is 3)
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 0');
    await expect(page.getByTestId('diagram-card')).not.toBeVisible();

    // Escalate to Level 1
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 1');
    await expect(page.getByTestId('diagram-card')).not.toBeVisible();

    // Escalate to Level 2
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 2');
    await expect(page.getByTestId('diagram-card')).not.toBeVisible();

    // Escalate to Level 3: Diagram card is presented!
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 3');

    // Verify Diagram Card and elements are rendered
    const diagramCard = page.getByTestId('diagram-card');
    await expect(diagramCard).toBeVisible();

    // Verify title
    await expect(page.getByTestId('diagram-title')).toContainText("Ratio Table: Leo and Maya's Shares");

    // Verify SVG diagram element is rendered
    const diagramSvg = page.getByTestId('diagram-svg');
    await expect(diagramSvg).toBeVisible();

    // Verify textual description beside/below the diagram (PRD FR-09)
    const diagramDesc = page.getByTestId('diagram-description');
    await expect(diagramDesc).toBeVisible();
    await expect(diagramDesc).toContainText("Ratio table comparing Leo's 2 parts, Maya's 3 parts, and total 5 parts totaling $60");

    // Verify hash badge is displayed with content hash
    const hashBadge = page.getByTestId('diagram-hash');
    await expect(hashBadge).toBeVisible();
    await expect(hashBadge).toContainText('sha256:');
  });

  test('Criterion 1 (API): GET /api/sessions/:id/diagram returns 200 image/svg+xml at Level 3, but 404 at Level 0-2', async ({
    request,
  }) => {
    // Create new session
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_share_001', student_id: 'student_diagram_api' },
    });
    expect(createRes.status()).toBe(201);
    const { session } = await createRes.json();
    const sessionId = session.id;

    // At Level 0: Diagram endpoint returns 404 (min_level = 3)
    const getL0Res = await request.get(`/api/sessions/${sessionId}/diagram`);
    expect(getL0Res.status()).toBe(404);

    // Escalate session to Level 3 via events
    await request.post(`/api/sessions/${sessionId}/events`, { data: { event: 'not_sure' } }); // Level 1
    await request.post(`/api/sessions/${sessionId}/events`, { data: { event: 'not_sure' } }); // Level 2
    await request.post(`/api/sessions/${sessionId}/events`, { data: { event: 'not_sure' } }); // Level 3

    // At Level 3: Diagram endpoint returns 200 image/svg+xml with secure headers
    const getL3Res = await request.get(`/api/sessions/${sessionId}/diagram`);
    expect(getL3Res.status()).toBe(200);
    expect(getL3Res.headers()['content-type']).toContain('image/svg+xml');
    expect(getL3Res.headers()['content-security-policy']).toBe("default-src 'none'");
    expect(getL3Res.headers()['cache-control']).toBe('private');
    expect(getL3Res.headers()['x-diagram-hash']).toContain('sha256:');

    const svgBody = await getL3Res.text();
    expect(svgBody).toContain('<svg');
    expect(svgBody).toContain('role="img"');
    expect(svgBody).toContain('<title id="svg-diag-title">Ratio Table: Leo and Maya&apos;s Shares</title>');
  });

  test('Criterion 2: When diagram validation fails or no approved version exists, question is withheld and flagged', async ({
    request,
    page,
  }) => {
    // 1. Backend availability check (POST /api/sessions with ratio_diagram_withheld_001)
    const createRes = await request.post('/api/sessions', {
      data: { question_id: 'ratio_diagram_withheld_001', student_id: 'student_withheld_test' },
    });
    expect(createRes.status()).toBe(201);
    const resData = await createRes.json();

    // Verify session flags and question.is_withheld
    expect(resData.question.is_withheld).toBe(true);
    expect(resData.question.withheld_reason).toBe('no_approved_variant');
    expect(resData.session.flags).toContain('diagram_unapproved');

    // Attempting to fetch diagram returns 404
    const diagRes = await request.get(`/api/sessions/${resData.session.id}/diagram`);
    expect(diagRes.status()).toBe(404);

    // 2. UI presentation of withheld warning
    await page.goto(`/practice?question_id=ratio_diagram_withheld_001`);
    const withheldAlert = page.getByTestId('question-withheld-alert');
    await expect(withheldAlert).toBeVisible();
    await expect(withheldAlert).toContainText('Question Withheld');
    await expect(withheldAlert).toContainText('Visual model validation failed or no approved diagram variant exists');
  });

  test('Criterion 3: Keyboard and screen-reader accessibility, non-empty alt text, and non-colour visual distinctions', async ({
    page,
    request,
  }) => {
    await page.goto('/practice');

    // Escalate to Level 3 to display diagram
    await page.getByTestId('not-sure-btn').click();
    await page.getByTestId('not-sure-btn').click();
    await page.getByTestId('not-sure-btn').click();
    await expect(page.getByTestId('hint-level-badge')).toContainText('Level 3');

    const diagramSvg = page.getByTestId('diagram-svg');
    await expect(diagramSvg).toBeVisible();

    // Text alternative exists and is non-empty
    const altText = await diagramSvg.getAttribute('alt');
    expect(altText).toBeTruthy();
    expect(altText).toContain('A ratio table with rows for Leo, Maya, and Total');

    // Focusable by keyboard (tabIndex 0)
    const tabIndex = await diagramSvg.getAttribute('tabindex');
    expect(tabIndex).toBe('0');

    // A11y verification badge rendered
    await expect(page.getByTestId('diagram-a11y-note')).toContainText('A11y Verified');

    // Verify SVG markup has patterns and shapes (meaning does not depend on colour alone)
    const checkerRes = await request.post('/api/checker/diagram', {
      data: {
        spec: DIAGRAM_ASSETS.diag_ratio_share_001,
        question: { accepted_answer_spec: { canonical_value: '36' }, final_answer: '36' },
        level: 3,
      },
    });
    const checkerData = await checkerRes.json();
    expect(checkerData.valid).toBe(true);
    expect(checkerData.svg).toContain('id="pat-diagonal"');
    expect(checkerData.svg).toContain('id="pat-dots"');
    expect(checkerData.svg).toContain('id="pat-crosshatch"');
    expect(checkerData.svg).toContain('●');
    expect(checkerData.svg).toContain('▲');
    expect(checkerData.svg).toContain('■');
  });

  test('Criterion 4: Rendered below Level 5 masks intermediate steps and final answers with ? or x; leakage fails validation', async ({
    request,
  }) => {
    const questionData = {
      accepted_answer_spec: { canonical_value: '36' },
      final_answer: '36',
      solution_steps: [
        { step_id: 'step_1', target_value: '5' },
        { step_id: 'step_2', target_value: '12' },
        { step_id: 'step_3', target_value: '36' },
      ],
    };

    // 1. Valid Level 3 diagram masks unknown final answer with '?'
    const validLevel3 = validateDiagram(DIAGRAM_ASSETS.diag_ratio_share_001, questionData, 3);
    expect(validLevel3.valid).toBe(true);
    expect(validLevel3.svg).toContain('data-testid="diagram-cell-value-1"');
    // Maya's share in Level 3 rendered SVG must be masked as '?'
    expect(validLevel3.svg).toMatch(/data-testid="diagram-cell-value-1"[\s\S]*?\?[\s\S]*?<\/text>/);

    // 2. Leaked diagram that shows final answer "36" below Level 5 FAILS leakage check
    const leakedSpec = {
      type: 'ratio_table',
      title: 'Leaked Ratio Table',
      description: 'Showing shares',
      alt_text: 'Ratio table with Leo and Maya',
      min_level: 3,
      headers: ['Person', 'Parts', 'Amount'],
      rows: [
        { label: 'Leo', parts: '2', below_4: '?' },
        { label: 'Maya', parts: '3', below_4: '36' }, // Final answer 36 leaked at Level 3!
        { label: 'Total', parts: '5', below_4: '60' },
      ],
    };

    const leakCheck = validateDiagram(leakedSpec, questionData, 3);
    expect(leakCheck.valid).toBe(false);
    expect(leakCheck.reason).toBe('leakage_detected');
    expect(leakCheck.violations.some((v: string) => v.includes('36'))).toBe(true);

    // 3. Diagram leaking intermediate calculation step "12" below Level 4 FAILS check
    const leakedStepSpec = {
      type: 'ratio_table',
      title: 'Step Leaked Table',
      description: 'Intermediate step leaked',
      alt_text: 'Ratio table with step',
      min_level: 3,
      headers: ['Person', 'Parts', 'Amount'],
      rows: [
        { label: 'One Part', parts: '1', below_4: '12' }, // Leaked intermediate step 12 below Level 4!
        { label: 'Maya', parts: '3', below_4: '?' },
        { label: 'Total', parts: '5', below_4: '60' },
      ],
    };

    const stepCheck = validateDiagram(leakedStepSpec, questionData, 3);
    expect(stepCheck.valid).toBe(false);
    expect(stepCheck.reason).toBe('leakage_detected');
    expect(stepCheck.violations.some((v: string) => v.includes('12'))).toBe(true);
  });

  test('Criterion 5: Leakage check inspects <title>, <desc>, aria-label, alt text, and adjacent description', async ({
    request,
  }) => {
    const questionData = {
      accepted_answer_spec: { canonical_value: '36' },
      final_answer: '36',
    };

    // 1. Leak in title
    const leakInTitle = {
      type: 'ratio_table',
      title: 'Ratio Table Showing Maya receives 36 dollars', // Leaked 36 in title!
      description: 'Ratio table comparing shares',
      alt_text: 'Ratio table',
      min_level: 3,
      headers: ['Person', 'Parts', 'Amount'],
      rows: [
        { label: 'Leo', parts: '2', below_4: '?' },
        { label: 'Maya', parts: '3', below_4: '?' },
      ],
    };
    const titleRes = validateDiagram(leakInTitle, questionData, 3);
    expect(titleRes.valid).toBe(false);
    expect(titleRes.reason).toBe('leakage_detected');

    // 2. Leak in alt_text
    const leakInAlt = {
      type: 'ratio_table',
      title: 'Ratio Table',
      description: 'Ratio table comparing shares',
      alt_text: 'Diagram showing Maya receives 36', // Leaked in alt text!
      min_level: 3,
      headers: ['Person', 'Parts', 'Amount'],
      rows: [
        { label: 'Leo', parts: '2', below_4: '?' },
        { label: 'Maya', parts: '3', below_4: '?' },
      ],
    };
    const altRes = validateDiagram(leakInAlt, questionData, 3);
    expect(altRes.valid).toBe(false);
    expect(altRes.reason).toBe('leakage_detected');

    // 3. Leak in description shown beside diagram
    const leakInDesc = {
      type: 'ratio_table',
      title: 'Ratio Table',
      description: 'Notice that multiplying 12 by 3 gives 36 dollars', // Leaked in adjacent description!
      alt_text: 'Clean alt text',
      min_level: 3,
      headers: ['Person', 'Parts', 'Amount'],
      rows: [
        { label: 'Leo', parts: '2', below_4: '?' },
        { label: 'Maya', parts: '3', below_4: '?' },
      ],
    };
    const descRes = validateDiagram(leakInDesc, questionData, 3);
    expect(descRes.valid).toBe(false);
    expect(descRes.reason).toBe('leakage_detected');

    // 4. Stored metadata format: version, hash, validation_result
    const cleanRes = validateDiagram(DIAGRAM_ASSETS.diag_ratio_share_001, questionData, 3);
    expect(cleanRes.valid).toBe(true);
    expect(cleanRes.version).toBe(1);
    expect(cleanRes.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(cleanRes.validation_result).toBe('valid');
  });

});
