"use client"

import { useEffect, useState } from "react"
import { upload } from "@vercel/blob/client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { FileText, LoaderCircle, Plus, RefreshCw, Upload, XCircle } from "lucide-react"

type Newsletter = {
  id: number
  title: string
  month: string
  year: number
  description: string | null
  pdf_url: string
  download_name?: string
  download_url: string
  is_published: boolean
  created_at: string
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)
const MAX_PDF_SIZE_BYTES = 250 * 1024 * 1024
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

export default function NewslettersAdminPage() {
  const router = useRouter()
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [title, setTitle] = useState("")
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()])
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState("")
  const [isPublished, setIsPublished] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    fetchNewsletters()
  }, [router])

  const fetchNewsletters = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/newsletters")

      if (res.status === 401) {
        router.push("/admin/login")
        return
      }

      if (!res.ok) {
        throw new Error("Failed to fetch newsletters")
      }

      const data = await res.json()
      setNewsletters(Array.isArray(data?.newsletters) ? data.newsletters : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching data")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle("")
    setMonth(MONTHS[new Date().getMonth()])
    setYear(new Date().getFullYear().toString())
    setDescription("")
    setFile(null)
    setPdfUrl("")
    setIsPublished(true)
    setUploadError(null)
    setUploadProgress(0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setUploadError(null)
    setUploadProgress(0)

    if (!file && !pdfUrl.trim()) {
      setUploadError("Please upload a PDF or provide a URL.")
      setSubmitting(false)
      return
    }

    try {
      let resolvedPdfUrl = pdfUrl.trim()
      let storageType: "external" | "local" | "blob-private" = resolvedPdfUrl.startsWith("/")
        ? "local"
        : "external"
      let downloadName = `${sanitizeFilename(title) || "newsletter"}.pdf`

      if (file) {
        if (file.type !== "application/pdf") {
          throw new Error("Only PDF files are allowed.")
        }

        if (file.size > MAX_PDF_SIZE_BYTES) {
          throw new Error(`PDF is too large. The current limit is ${formatFileSize(MAX_PDF_SIZE_BYTES)}.`)
        }

        setUploadingFile(true)

        const safeName = sanitizeFilename(file.name) || `newsletter-${Date.now()}.pdf`
        const blob = await upload(`newsletters/${year}/${safeName}`, file, {
          access: "private",
          contentType: "application/pdf",
          handleUploadUrl: "/api/admin/newsletters/client-upload",
          onUploadProgress: (event) => {
            setUploadProgress(Math.round(event.percentage))
          },
        })

        resolvedPdfUrl = blob.url
        storageType = "blob-private"
        downloadName = file.name.trim() || downloadName
      }

      const res = await fetch("/api/admin/newsletters", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          month,
          year,
          description,
          is_published: isPublished,
          pdf_url: resolvedPdfUrl,
          storage_type: storageType,
          download_name: downloadName,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to publish newsletter")
      }

      resetForm()
      setIsModalOpen(false)
      fetchNewsletters()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again."
      setUploadError(
        message.includes("413")
          ? "The upload was blocked before it reached storage. Please retry after the updated deployment is live."
          : message,
      )
    } finally {
      setUploadingFile(false)
      setSubmitting(false)
    }
  }

  const selectedFileSize = file ? formatFileSize(file.size) : null
  const isLargeFile = file ? file.size >= 100 * 1024 * 1024 : false

  return (
    <div className="min-h-screen bg-[#fdf6f0] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#3c2415]">Newsletters</h1>
            <p className="text-gray-600">Manage your monthly journal publications</p>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={fetchNewsletters}
              disabled={loading}
              className="border-[#3c2415] text-[#3c2415]"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Dialog
              open={isModalOpen}
              onOpenChange={(open) => {
                setIsModalOpen(open)
                if (!open) {
                  resetForm()
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-[#3c2415] text-white hover:bg-[#5a3620]">
                  <Plus className="mr-2 h-4 w-4" />
                  Publish Newsletter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Publish Newsletter</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. CA Journal May-2026"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Select value={year} onValueChange={setYear}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map((item) => (
                            <SelectItem key={item} value={item.toString()}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a brief description..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Newsletter PDF</Label>
                    <div className="rounded-lg border border-dashed border-[#d8c1ad] bg-[#fffaf5] p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded border border-gray-300 bg-gray-100">
                          <FileText className="h-6 w-6 text-gray-500" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-[#3c2415]">
                            Upload a PDF up to {formatFileSize(MAX_PDF_SIZE_BYTES)}
                          </p>
                          <p className="text-xs text-gray-500">Max {formatFileSize(MAX_PDF_SIZE_BYTES)}.</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          id="newsletter-pdf"
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const nextFile = e.target.files?.[0] || null
                            setUploadError(null)
                            setUploadProgress(0)
                            setFile(nextFile)
                            if (nextFile) {
                              setPdfUrl("")
                            }
                          }}
                        />
                        <label htmlFor="newsletter-pdf">
                          <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer border-[#3c2415] text-[#3c2415]"
                            asChild
                          >
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              {file ? "Replace PDF" : "Upload PDF"}
                            </span>
                          </Button>
                        </label>

                        {file ? (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-[#3c2415]">{file.name}</span>
                            {" · "}
                            {selectedFileSize}
                            {isLargeFile ? " · Large file" : ""}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No file selected yet</div>
                        )}
                      </div>

                      {(uploadingFile || uploadProgress > 0) && file ? (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>{uploadingFile ? "Uploading PDF..." : "Upload ready"}</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-2 bg-[#eadbcc]" />
                        </div>
                      ) : null}
                    </div>

                    <div className="my-2 text-center text-sm text-gray-500">OR</div>
                    <Input
                      placeholder="Paste a PDF URL / path"
                      value={pdfUrl}
                      onChange={(e) => {
                        setPdfUrl(e.target.value)
                        if (e.target.value) {
                          setFile(null)
                          setUploadError(null)
                        }
                      }}
                      disabled={!!file}
                    />
                    <p className="text-xs text-gray-500">
                      Supported: direct upload, website PDF URL, or a local path already served by the site.
                    </p>
                    {uploadError ? <p className="mt-1 text-sm text-red-500">{uploadError}</p> : null}
                  </div>

                  <div className="flex items-center space-x-2 pt-4">
                    <Switch id="published" checked={isPublished} onCheckedChange={setIsPublished} />
                    <Label htmlFor="published">Published (visible on website)</Label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting} className="bg-[#3c2415] text-white hover:bg-[#5a3620]">
                      {submitting ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          {uploadingFile ? "Uploading PDF..." : "Publishing..."}
                        </>
                      ) : (
                        "Publish"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Published Journals</CardTitle>
            <CardDescription>A list of all uploaded newsletters.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-gray-500">Loading newsletters...</div>
            ) : newsletters.length === 0 ? (
              <div className="py-8 text-center text-gray-500">No newsletters published yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Period</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Date Added</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newsletters.map((newsletter) => (
                      <tr key={newsletter.id} className="border-b bg-white">
                        <td className="flex items-center gap-2 px-6 py-4 font-medium text-gray-900">
                          <FileText className="h-4 w-4 text-[#3c2415]" />
                          {newsletter.title}
                        </td>
                        <td className="px-6 py-4">
                          {newsletter.month} {newsletter.year}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={newsletter.is_published ? "default" : "secondary"}
                            className={newsletter.is_published ? "bg-green-600" : ""}
                          >
                            {newsletter.is_published ? "Published" : "Draft"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">{new Date(newsletter.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <a
                            href={newsletter.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
