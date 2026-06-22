"use client"

import { useRef, useState } from "react"
import { put } from "@vercel/blob/client"
import { Upload, X, FileText, ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

interface FileUploadProps {
  value: string
  onChange: (url: string) => void
  folder: string
  accept?: string
  kind?: "image" | "pdf"
}

const MAX_PDF_SIZE_BYTES = 250 * 1024 * 1024
const MAX_PDF_SIZE_LABEL = "250 MB"
function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function FileUpload({ value, onChange, folder, accept = "image/*", kind = "image" }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFileName, setSelectedFileName] = useState("")
  const [selectedFileSize, setSelectedFileSize] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError("")
    setUploadProgress(0)
    setSelectedFileName(file.name)
    setSelectedFileSize(formatFileSize(file.size))

    try {
      if (kind === "pdf") {
        if (file.type !== "application/pdf") {
          throw new Error("Only PDF files are allowed.")
        }

        if (file.size > MAX_PDF_SIZE_BYTES) {
          throw new Error(`PDF is too large. The current limit is ${formatFileSize(MAX_PDF_SIZE_BYTES)}.`)
        }

        const safeName = sanitizeFilename(file.name) || `newsletter-${Date.now()}.pdf`
        const yearFolder = new Date().getFullYear()
        const pathname = `${folder}/${yearFolder}/${safeName}`
        const tokenResponse = await fetch("/api/admin/newsletters/client-upload", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ pathname }),
        })

        const tokenData = await tokenResponse.json()

        if (!tokenResponse.ok || !tokenData.clientToken) {
          throw new Error(tokenData.error || "Failed to prepare upload.")
        }

        const blob = await put(pathname, file, {
          token: tokenData.clientToken,
          access: "private",
          contentType: "application/pdf",
          onUploadProgress: (event) => {
            setUploadProgress(Math.round(event.percentage))
          },
        })

        onChange(blob.url)
        setUploadProgress(100)
        return
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", folder)
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok && data.success) {
        onChange(data.url)
        setUploadProgress(100)
      } else {
        setError(data.error || "Upload failed")
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value || "/placeholder.svg"}
              alt="Preview"
              className="h-16 w-16 rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted">
              <FileText className="h-7 w-7 text-amber-700" />
            </div>
          )
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed bg-muted/50">
            {kind === "image" ? (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            ) : (
              <FileText className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-fit"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {value ? "Replace" : "Upload"} {kind === "pdf" ? "PDF" : "image"}
              </>
            )}
          </Button>

          {kind === "pdf" ? (
            <p className="text-xs text-muted-foreground">Max {MAX_PDF_SIZE_LABEL}.</p>
          ) : null}

          {selectedFileName ? (
            <p className="text-xs text-muted-foreground">
              {selectedFileName}
              {selectedFileSize ? ` · ${selectedFileSize}` : ""}
            </p>
          ) : null}

          {value ? (
            <Button type="button" variant="ghost" size="sm" className="w-fit text-destructive" onClick={() => onChange("")}>
              <X className="mr-1 h-3 w-3" /> Remove
            </Button>
          ) : null}
        </div>
      </div>

      {(uploading || uploadProgress > 0) && kind === "pdf" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{uploading ? "Uploading PDF..." : "Upload complete"}</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Or paste a ${kind === "pdf" ? "PDF" : "image"} URL / path`}
        className="text-xs"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
