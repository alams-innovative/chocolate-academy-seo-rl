import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-guard"
import { createNewsletter, getNewsletters } from "@/lib/cms"

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const newsletters = await getNewsletters(false)
    return NextResponse.json({
      newsletters: newsletters.map((newsletter) => ({
        ...newsletter,
        download_url: `/api/newsletters/${newsletter.id}/download`,
        is_published: newsletter.is_active,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch newsletters" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const contentType = request.headers.get("content-type") || ""
    let title = ""
    let month = ""
    let year = 0
    let description = ""
    let is_active = false
    let pdf_url = ""
    let storage_type: "external" | "local" | "blob-private" = "external"
    let download_name = ""

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        title?: string
        month?: string
        year?: number | string
        description?: string
        is_published?: boolean
        pdf_url?: string
        storage_type?: "external" | "local" | "blob-private"
        download_name?: string
      }

      title = String(body.title || "")
      month = String(body.month || "")
      year = Number(body.year || 0)
      description = String(body.description || "")
      is_active = Boolean(body.is_published)
      pdf_url = String(body.pdf_url || "")
      storage_type =
        body.storage_type ||
        (pdf_url.startsWith("/") ? "local" : "external")
      download_name = String(body.download_name || "")
    } else {
      const formData = await request.formData()
      title = String(formData.get("title") || "")
      month = String(formData.get("month") || "")
      year = Number(formData.get("year") || 0)
      description = String(formData.get("description") || "")
      is_active = formData.get("is_published") === "true"
      pdf_url = String(formData.get("pdf_url") || "")
      storage_type = pdf_url.startsWith("/") ? "local" : "external"
      download_name = String(formData.get("download_name") || "")
    }

    if (!title || !month || !year || !pdf_url) {
      return NextResponse.json({ success: false, error: "Missing newsletter fields" }, { status: 400 })
    }

    const safeDownloadName =
      download_name.trim() || `${title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "newsletter"}.pdf`

    const newsletter = await createNewsletter({
      title,
      month,
      year,
      pdf_url,
      download_name: safeDownloadName,
      description,
      is_active,
      storage_type,
    })

    return NextResponse.json({
      success: true,
      newsletter: {
        ...newsletter,
        download_url: `/api/newsletters/${newsletter.id}/download`,
        is_published: newsletter.is_active,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create newsletter" },
      { status: 500 },
    )
  }
}
