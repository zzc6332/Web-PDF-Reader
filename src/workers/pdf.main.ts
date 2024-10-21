import {
  WorkerHandler,
  WorkerProxy,
  CarrierProxy,
} from "src/worker-handler/main";
// import { WorkerHandler, WorkerProxy, CarrierProxy } from "worker-handler";
import { PdfWorkerActions } from "./pdf.worker";
import workerUrl from "./pdf.worker.ts?worker&url";

const pdfWorker = new WorkerHandler<PdfWorkerActions>(workerUrl);

export { pdfWorker, type WorkerProxy, type CarrierProxy };
