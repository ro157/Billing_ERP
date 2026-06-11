export async function fetchDocumentPdf(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) {
    let message = 'Failed to generate PDF'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // response was not JSON
    }
    throw new Error(message)
  }
  return res.blob()
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

export function printPdfBlobUrl(blobUrl: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none'
  iframe.src = blobUrl

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => iframe.remove(), 1500)
    }
  }

  document.body.appendChild(iframe)
}
