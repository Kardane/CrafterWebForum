import ComposerPageLayout from "@/components/editor/ComposerPageLayout";
import InquiryForm from "@/components/inquiries/InquiryForm";

export default function NewInquiryPage() {
	return (
		<ComposerPageLayout
			title="새 문의 작성"
			description="문제 상황과 재현 방법을 자세히 적어주면 더 빠르게 처리 가능"
			backHref="/inquiries"
			backLabel="문의 목록"
		>
			<InquiryForm />
		</ComposerPageLayout>
	);
}
