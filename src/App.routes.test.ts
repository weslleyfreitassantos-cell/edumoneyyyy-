import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

describe('learning center and library routes', () => {
  it('keeps the student routes and their role boundaries', () => {
    expect(appSource).toContain('path="/student/study"');
    expect(appSource).toContain("allowedRoles={['STUDENT']}");
    expect(appSource).toContain('path="/student/study/activity/:activityId"');
    expect(appSource).toContain('path="/dashboard/library"');
    expect(appSource).toContain("allowedRoles={['TEACHER', 'STUDENT']}");
  });

  it('keeps the teacher pedagogical routes and their role boundaries', () => {
    expect(appSource).toContain('path="/teacher/pedagogical-center"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/activities"');
    expect(appSource).toContain("allowedRoles={['TEACHER']}");
  });
});
