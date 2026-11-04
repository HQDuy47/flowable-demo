// Các trang do app con expose qua Module Federation, tải lúc chạy.
// Khai báo tay để TypeScript biết "makerCheckerApp/...", "adminApp/..." là component React.
type RemotePage = import('react').ComponentType;

declare module 'makerCheckerApp/CreateRequestPage' { const Page: RemotePage; export default Page; }
declare module 'makerCheckerApp/ApprovalQueuePage' { const Page: RemotePage; export default Page; }
declare module 'makerCheckerApp/ApprovalDetailPage' { const Page: RemotePage; export default Page; }

declare module 'adminApp/RequestTypesPage' { const Page: RemotePage; export default Page; }
declare module 'adminApp/RequestTypeEditorPage' { const Page: RemotePage; export default Page; }
