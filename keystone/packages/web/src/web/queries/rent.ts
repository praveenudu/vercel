import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { useAction } from "./common";

export const useRentRoll = () => useQuery(orpc.rent.roll.queryOptions());
export const useLedger = (leaseId: number, enabled = true) => useQuery({ ...orpc.rent.ledger.queryOptions({ input: { leaseId } }), enabled });
export const useMyPayments = () => useQuery(orpc.rent.myPayments.queryOptions());
export const useRecordPayment = () => useAction(orpc.rent.record.mutationOptions());
export const useReportPayment = () => useAction(orpc.rent.report.mutationOptions());
export const useReviewPayment = () => useAction(orpc.rent.review.mutationOptions());
export const useSendReminders = () => useAction(orpc.rent.sendReminders.mutationOptions());
