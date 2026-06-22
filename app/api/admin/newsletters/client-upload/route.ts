import { type HandleUploadBody, handleUpload } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-guard"

const MAX_NEWSLETTER_PDF_SIZE = 250 * 1024 * 1024
const NEWSLETTER_PATH_PATTERN = /^newsletters\/\d{4}\/[a-z0-9._-]+\.pdf$/i

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as HandleUploadBody
    const callbackUrl = new URL("/api/admin/newsletters/client-upload", request.url).toString()

    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!NEWSLETTER_PATH_PATTERN.test(pathname)) {
          throw new Error("Invalid newsletter upload path")
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_NEWSLETTER_PDF_SIZE,
          addRandomSuffix: true,
          callbackUrl,
        }
      },
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(json)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare upload" },
      { status: 400 },
    )
  }
}
