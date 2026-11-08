import { useSearchParams } from 'react-router-dom';

import GuidedJourneyPage from './GuidedJourneyPage';
import LegacyGuidedJourneyPage from './LegacyGuidedJourneyPage';

export default function GuidedStudyRoute() {
  const [searchParams] = useSearchParams();
  return searchParams.has('session') ? <GuidedJourneyPage /> : <LegacyGuidedJourneyPage />;
}
