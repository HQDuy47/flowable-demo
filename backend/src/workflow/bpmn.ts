/** Người duyệt của mọi loại đơn (khớp common/users.ts). */
export const APPROVER = 'checker';

/** Quy trình chung cho mọi loại đơn. */
export const GENERIC_PROCESS_KEY = 'requestApproval';

/** Biến của process cho biết đơn thuộc loại nào, phiên bản nào. */
export const TYPE_VARS = {
  key: 'requestType',
  version: 'requestTypeVersion',
  name: 'requestTypeName',
} as const;

/**
 * Quy trình chung: lập đơn → trưởng phòng duyệt → rẽ nhánh theo biến "decision".
 * formKey của user task là biểu thức, Flowable tính lúc tạo task từ biến của đơn
 * → "leaveRequest:1:approve"; backend tra form theo chuỗi đó (RequestTypesService.formByKey).
 * startEvent không gắn formKey: form lập đơn hiện trước khi có biến, nên chọn theo loại đơn người dùng bấm.
 */
export const GENERIC_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://seatech.demo/request-types">
  <process id="${GENERIC_PROCESS_KEY}" name="Request approval" isExecutable="true">
    <startEvent id="start" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="managerApprove" />
    <userTask id="managerApprove" name="Manager approval" flowable:assignee="${APPROVER}"
              flowable:formKey="\${${TYPE_VARS.key}}:\${${TYPE_VARS.version}}:approve" />
    <sequenceFlow id="f2" sourceRef="managerApprove" targetRef="gw" />
    <exclusiveGateway id="gw" />
    <sequenceFlow id="f3" sourceRef="gw" targetRef="approvedEnd">
      <conditionExpression xsi:type="tFormalExpression">\${decision == 'approve'}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f4" sourceRef="gw" targetRef="rejectedEnd">
      <conditionExpression xsi:type="tFormalExpression">\${decision == 'reject'}</conditionExpression>
    </sequenceFlow>
    <endEvent id="approvedEnd" name="Approved" />
    <endEvent id="rejectedEnd" name="Rejected" />
  </process>
</definitions>
`;
