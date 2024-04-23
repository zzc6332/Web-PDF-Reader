import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
