import styles from "./styles.module.css"
import States from "./States"

export default function ShowcaseAccordion({ slots = [] }: { slots?: string[] }) {
  return (
      <States
        a={<>
          <div className={styles["open"]}>
            <div className={styles["heading-4"]}>
              <div className={styles["indicator"]} />
              <div className={styles["title-4"]}>
                <h6 className={styles["h6-4"]}>{"Pick a project that already runs"}</h6>
              </div>
            </div>
            <div className={styles["description-4"]}>
              <p className={styles["p-15"]}>{"Browse real projects, not screenshots. Open one and it's already running — routes, components, styles, all of it. Your starting point is a working codebase, not a zip file."}</p>
            </div>
          </div>
        </>}
        b={<>
          <div className={styles["closed"]}>
            <div className={styles["heading-4"]}>
              <div className={styles["indicator-2"]} />
              <div className={styles["title-4"]}>
                <h6 className={styles["h6-4"]}>{"Pick a project that already runs"}</h6>
              </div>
            </div>
          </div>
        </>}
      />
  )
}
