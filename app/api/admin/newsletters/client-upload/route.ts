import { issueSignedToken } from "@vercel/blob"
import { type HandleUploadPresignedBody, handleUploadPresigned } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-guard"

const MAX_NEWSLETTER_PDF_SIZE = 250 * 1024 * 1024
const NEWSLETTER_PATH_PATTERN = /^newsletters\/\d{4}\/[a-z0-9._-]+\.pdf$/i

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as HandleUploadPresignedBody

    const json = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!NEWSLETTER_PATH_PATTERN.test(pathname)) {
          throw new Error("Invalid newsletter upload path")
        }

        return {
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: MAX_NEWSLETTER_PDF_SIZE,
            validUntil: Date.now() + 60 * 60 * 1000,
          }),
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
