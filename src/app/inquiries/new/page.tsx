import InquiryForm from '@/components/inquiries/InquiryForm';

export default function NewInquiryPage() {
	return (
		<div className="max-w-2xl mx-auto p-6">
			<h1 className="text-2xl font-bold mb-6">새 문의 작성</h1>
			<InquiryForm />
		</div>
	);
}
