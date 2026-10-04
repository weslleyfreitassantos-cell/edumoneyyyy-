import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const progressPath = path.resolve(root, 'content/bncc/progress.json');
const packagePath = path.resolve(root, 'content/bncc/packages/tec-escola-core-v4.json');
const progressText = fs.readFileSync(progressPath, 'utf8');
const progress = JSON.parse(progressText);
const contentPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const summary = contentPackage.summary;
const derived = {
  techValidatedSkills: summary.techValidatedSkills,
  scaffoldSkills: summary.scaffoldSkills,
  totalLessons: summary.totalLessons,
  totalQuestions: summary.totalQuestions,
};

const updatedText = progressText
  .replace(/("updatedAt":\s*")[^"]+(")/, `$1${new Date().toISOString()}$2`)
  .replace(/("techValidatedSkills":\s*)\d+/, `$1${derived.techValidatedSkills}`)
  .replace(/("scaffoldSkills":\s*)\d+/, `$1${derived.scaffoldSkills}`)
  .replace(/("totalLessons":\s*)\d+/, `$1${derived.totalLessons}`)
  .replace(/("totalQuestions":\s*)\d+/, `$1${derived.totalQuestions}`);
fs.writeFileSync(progressPath, updatedText, 'utf8');

console.log(`BNCC_PROGRESS_RECONCILED lessons=${derived.totalLessons} questions=${derived.totalQuestions} techValidated=${derived.techValidatedSkills}`);
