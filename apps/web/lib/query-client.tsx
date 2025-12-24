import { SWRConfig } from "swr"
import { authClient } from "./auth-client"

async function fetcher(url: string) {
  const session = await authClient.getSession()
  const headers: HeadersInit = {}

  if (session?.data?.session?.token) {
    headers["Authorization"] = `Bearer ${session.data.session.token}`
  }

  const res = await fetch(url, {
    credentials: "include",
    headers,
  })

  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        fetcher,
      }}
    >
      {children}
    </SWRConfig>
  )
}
