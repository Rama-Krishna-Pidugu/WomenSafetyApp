import { aiService } from './aiService';

describe('AIService Intent Handlers & Suggestion Tiles', () => {
  const userId = 'test-user-123';

  beforeEach(async () => {
    await aiService.clearHistory(userId);
  });

  // 1. "nearest police station"
  // Note: this hits the real Overpass API (no network mock in this suite), so whether a
  // real station is found depends on live network/test-runner conditions. Either outcome
  // must be a real, non-fabricated answer — never a placeholder distance/location.
  it('1. handles "nearest police station" with structured police info', async () => {
    const result = await aiService.processUserQuery(userId, 'nearest police station');
    expect(result.assistantMessage.content).toContain('POLICE INFORMATION');
    expect(result.assistantMessage.content).toContain('Emergency Helpline:');
    expect(result.assistantMessage.actionPayload?.suggestedActions).toContain('Directions');
  });

  // 2. "nearby police"
  it('2. handles "nearby police" query', async () => {
    const result = await aiService.processUserQuery(userId, 'nearby police');
    expect(result.assistantMessage.content).toContain('POLICE INFORMATION');
    expect(result.assistantMessage.content).toContain('Emergency Helpline:');
  });

  // 3. "someone is following me what should I do"
  it('3. handles "someone is following me what should I do" with actionable guidance', async () => {
    const result = await aiService.processUserQuery(userId, 'someone is following me what should I do');
    expect(result.assistantMessage.content).toContain('SAFETY GUIDANCE');
    expect(result.assistantMessage.content).toContain('Move toward a crowded, well-lit public place');
    expect(result.assistantMessage.actionPayload?.suggestedActions).toContain('Start Safety Journey');
  });

  // 4. "I feel unsafe"
  it('4. handles "I feel unsafe" natural language distress', async () => {
    const result = await aiService.processUserQuery(userId, 'I feel unsafe');
    expect(result.assistantMessage.content).toContain('SAFETY GUIDANCE');
    expect(result.assistantMessage.actionPayload?.suggestedActions).toContain('Nearby Police');
  });

  // 5. "first aid"
  it('5. handles "first aid" query', async () => {
    const result = await aiService.processUserQuery(userId, 'first aid');
    expect(result.assistantMessage.content).toContain('FIRST AID GUIDANCE');
    expect(result.assistantMessage.content).toContain('108');
  });

  // 6. "I need help" / emergency
  it('6. handles "I need help" and triggers emergency response', async () => {
    const result = await aiService.processUserQuery(userId, 'I need emergency help');
    expect(result.assistantMessage.content).toContain('EMERGENCY');
    expect(result.assistantMessage.actionPayload?.suggestedActions).toContain('Call 112');
  });

  // 7. "directions"
  it('7. handles "directions" query with navigation guidance', async () => {
    const result = await aiService.processUserQuery(userId, 'directions');
    expect(result.assistantMessage.content).toContain('DIRECTIONS');
    expect(result.assistantMessage.actionPayload?.suggestedActions).toContain('Directions');
  });

  // 8. "share my location"
  it('8. handles "share my location" query with coordinates and status', async () => {
    const result = await aiService.processUserQuery(userId, 'share my location');
    expect(result.assistantMessage.content).toContain('LOCATION SHARING');
    expect(result.assistantMessage.content).toContain('Coordinates:');
  });

  // 9. generic non-safety question
  it('9. handles generic conversational question with helpful safety-first guidance', async () => {
    const result = await aiService.processUserQuery(userId, 'Tell me about women safety');
    expect(result.assistantMessage.content.length).toBeGreaterThan(20);
    expect(result.assistantMessage.content).not.toContain('I am Aegis, your AI safety assistant. You asked:');
  });

  // 10. offline Gemini fallback
  it('10. handles offline Gemini fallback gracefully without raw errors', async () => {
    const result = await aiService.processUserQuery(userId, 'What are some tips for walking at night?');
    expect(result.assistantMessage.content).toBeDefined();
    expect(result.assistantMessage.content.length).toBeGreaterThan(15);
    expect(result.assistantMessage.content).not.toContain('[ERROR]');
  });
});
