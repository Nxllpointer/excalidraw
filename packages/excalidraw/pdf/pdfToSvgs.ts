import { Request, Response } from "./pdf-worker"
import PdfWorker from "./pdf-worker?worker"

/*
 * We use a web worker for converting the PDF to individual SVGs.
 * mupdf seems to have some memory issues and often corrupts itself after a couple pages.
 * The web worker is fully independent and can be restarted, enabling us to
 * fully reinitialize the mupdf library and continue from the page we crashed at.
 * Works surprisingly well and probably increases performance too, hurray
 */
export const pdfToSvgs = (
  pdf: File,
  pageConverted: (svg: File) => void
) => new Promise<void>((resolve, reject) => {
  let fromPage = 0
  let isRetry = false;

  const tryRun = (pdf: ArrayBuffer) => {
    let worker = new PdfWorker()
    worker.onmessage = ({ data: message }: MessageEvent<Response>) => {
      if (message.converting) {
        fromPage = message.converting.pageIndex
      }
      if (message.converted) {
        isRetry = false
        pageConverted(message.converted.svgFile)
      }
      if (message.done) {
        worker.terminate()
        resolve()
      }
    }
    worker.onerror = (event) => {
      if (isRetry) {
        console.log("PDF worker failed twice", event.error)
        reject(event.error)
      }
      else {
        worker.terminate()
        isRetry = true
        console.log("Respawning PDF worker")
        tryRun(pdf)
      }
    }

    worker.postMessage({ pdf, fromPage } as Request)
  }

  pdf.arrayBuffer().then(pdf => tryRun(pdf))
})

