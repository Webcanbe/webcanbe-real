import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function Navigation({ slots = [] }: { slots?: string[] }) {
  return (
      <nav className={styles["desktop"]}>
        <div className={styles["container"]}>
          <div className={styles["navbar"]}>
            <a className={styles["logo"]} href="./#hero">
              <div className={styles["mark"]}>
                <div className={styles["div"]}>
                  <SvgGraphic className={styles["svg"]} html={"<svg style=\"width:100%;height:100%;\" data-f2c-idx=\"12\"><use href=\"#svg10927535637\" data-f2c-idx=\"13\"></use></svg>"} />
                </div>
              </div>
              <div className={styles["aion"]}>
                <p className={styles["p"]}>{slots[0] ?? "Asset"}</p>
              </div>
            </a>
          </div>
          <div className={styles["menu"]}>
            <div className={styles["overview"]}>
              <div className={styles["p-2"]}>
                <a className={styles["a"]} href="./#overview">{slots[1] ?? "Overview"}</a>
              </div>
            </div>
            <div className={styles["features"]}>
              <div className={styles["p-3"]}>
                <a className={styles["a"]} href="./#features">{slots[2] ?? "Features"}</a>
              </div>
            </div>
            <div className={styles["integrations"]}>
              <div className={styles["p-4"]}>
                <a className={styles["a"]} href="./#integrations">{slots[3] ?? "Integrations"}</a>
              </div>
            </div>
            <div className={styles["benefits"]}>
              <div className={styles["p-5"]}>
                <a className={styles["a"]} href="./#benefits">{slots[4] ?? "Benefits"}</a>
              </div>
            </div>
            <div className={styles["about"]}>
              <div className={styles["p-6"]}>
                <a className={styles["a"]} href="./#about">{slots[5] ?? "About"}</a>
              </div>
            </div>
            <div className={styles["reviews"]}>
              <div className={styles["p-7"]}>
                <a className={styles["a"]} href="./">{slots[6] ?? "Reviews"}</a>
              </div>
            </div>
            <div className={styles["pricing"]}>
              <div className={styles["p-8"]}>
                <a className={styles["a"]} href="./#pricing">{slots[7] ?? "Pricing"}</a>
              </div>
            </div>
          </div>
          <div className={styles["cta"]}>
            <div className={styles["div-2"]}>
              <a className={styles["primary"]}>
                <div className={styles["get-started"]}>
                  <p className={styles["p-9"]}>{slots[8] ?? "Get started"}</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </nav>
  )
}
