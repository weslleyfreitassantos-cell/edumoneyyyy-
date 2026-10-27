import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

describe('learning center and library routes', () => {
  it('keeps the student routes and their role boundaries', () => {
    expect(appSource).toContain('path="/student/study"');
    expect(appSource).toContain('path="/student/study/english"');
    expect(appSource).toContain('path="/student/calendar"');
    expect(appSource).toContain("allowedRoles={['STUDENT']}");
    expect(appSource).toContain('path="/student/study/activity/:activityId"');
    expect(appSource).toContain('path="/dashboard/library"');
    expect(appSource).toContain("allowedRoles={['TEACHER', 'STUDENT']}");
  });

  it('keeps the teacher pedagogical routes and their role boundaries', () => {
    expect(appSource).toContain('path="/teacher/pedagogical-center"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/students"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/map"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/journeys"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/content"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/reviews"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/simulations"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/activities/new"');
    expect(appSource).toContain('path="/teacher/pedagogical-center/activities"');
    expect(appSource).toContain("allowedRoles={['TEACHER']}");
  });

  it('protects inventory for institution staff and excludes account/platform administrators', () => {
    expect(appSource).toContain('path="/inventory"');
    expect(appSource).toContain("allowedRoles={['DIRECTOR', 'SECRETARY', 'TEACHER']} deniedRoles={['ADMIN']} deniedPlatformRoles={['SUPER_ADMIN']}");
    expect(appSource).toContain("import('./components/inventory/InventoryPage')");
  });

  it('protects Tec Quiz Live routes by student and teacher role', () => {
    expect(appSource).toContain('path="/student/live-quiz"');
    expect(appSource).toContain('path="/teacher/classroom/live-quiz"');
    expect(appSource).toContain("allowedRoles={['STUDENT']}><AuthenticatedRouteContent><StudentLiveQuizPage />");
    expect(appSource).toContain("allowedRoles={['TEACHER']}><AuthenticatedRouteContent><TeacherLiveQuizPage />");
  });
});
