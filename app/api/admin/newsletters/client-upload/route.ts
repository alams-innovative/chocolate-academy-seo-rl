import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-guard"

const MAX_NEWSLETTER_PDF_SIZE = 250 * 1024 * 1024
const NEWSLETTER_PATH_PATTERN = /^newsletters\/\d{4}\/[a-z0-9._-]+\.pdf$/i

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as { pathname?: string }
    const pathname = String(body.pathname || "")

    if (!NEWSLETTER_PATH_PATTERN.test(pathname)) {
      return NextResponse.json({ error: "Invalid newsletter upload path" }, { status: 400 })
    }

    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: MAX_NEWSLETTER_PDF_SIZE,
      addRandomSuffix: true,
      validUntil: Date.now() + 60 * 60 * 1000,
    })

    return NextResponse.json({ clientToken })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare upload" },
      { status: 400 },
    )
  }
}
