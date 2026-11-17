import type { Metadata } from 'next';
import SurveyForm from './SurveyForm';

export const metadata: Metadata = {
    title: 'Khảo sát động lực và cách học môn Toán',
};

// Đọc SURVEY_PIN lúc chạy, không đóng băng lúc build.
export const dynamic = 'force-dynamic';

export default function SurveyPage() {
    return <SurveyForm needsPin={!!process.env.SURVEY_PIN} />;
}
