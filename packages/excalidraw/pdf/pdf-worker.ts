export interface Request {
  pdf: ArrayBuffer,
  fromPage: number
}

export interface Response {
  converting?: {
    pageIndex: number
  },
  converted?: {
    svgFile: File,
  }
  done: boolean
}

async function processPdf({ pdf, fromPage }: Request) {
  // @ts-ignore
  let mupdf = await import("mupdf")

  const document = mupdf.Document.openDocument(pdf)
  const pageCount = document.countPages()

  for (let pageIndex = fromPage; pageIndex < pageCount; pageIndex++) {
    postMessage({ converting: { pageIndex }, done: false } as Response)

    let buffer = new mupdf.Buffer()
    let writer = new mupdf.DocumentWriter(buffer, "svg", "text=path")
    let page = document.loadPage(pageIndex)

    let device = writer.beginPage(page.getBounds())
    page.run(device, mupdf.Matrix.identity)
    writer.endPage()

    device.close()
    device.destroy()
    page.destroy()
    writer.close()
    writer.destroy()

    const svgFile = new File([buffer.asUint8Array()], `page${pageIndex}.svg`, { type: "image/svg+xml" })

    buffer.destroy()

    postMessage({
      converted: {
        svgFile
      },
      done: false
    } as Response)
  }

  postMessage({ done: true } as Response)
}

onmessage = async ({ data }: MessageEvent<Request>) => {
  processPdf(data)
    .catch(error => setTimeout(() => { throw error })) // Errors are not sent to `onerror` when using promises
}
