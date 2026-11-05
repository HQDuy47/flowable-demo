// Các trang do app con expose qua Module Federation, tải lúc chạy.
// Khai báo tay để TypeScript biết "makerApp/...", "checkerApp/...", "adminApp/..." là component React.
type RemotePage = import('react').ComponentType;

declare module 'makerApp/CreateRequestPage' { const Page: RemotePage; export default Page; }

declare module 'checkerApp/ApprovalQueuePage' { const Page: RemotePage; export default Page; }
declare module 'checkerApp/ApprovalDetailPage' { const Page: RemotePage; export default Page; }

declare module 'adminApp/RequestTypesPage' { const Page: RemotePage; export default Page; }
declare module 'adminApp/RequestTypeEditorPage' { const Page: RemotePage; export default Page; }
