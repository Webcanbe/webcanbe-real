import LaunchUIHome from "./launch-ui/app/page"
import "./launch-ui/app/globals.css"

export default function Home() {
  return (
    <div className="launch-ui-page dark" style={{ colorScheme: "dark" }}>
      <LaunchUIHome />
    </div>
  )
}
