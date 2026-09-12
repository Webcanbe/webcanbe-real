import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function Footer({ slots = [] }: { slots?: string[] }) {
  return (
      <footer className={styles["desktop-2"]}>
        <div className={styles["container-5"]}>
          <div className={styles["info"]}>
            <div className={styles["description-10"]}>
              <a className={styles["logo-2"]} href="./#hero">
                <div className={styles["mark"]}>
                  <div className={styles["div"]}>
                    <SvgGraphic className={styles["svg"]} html={"<svg style=\"width:100%;height:100%;\" data-f2c-idx=\"1017\"><use href=\"#svg10927535637\" data-f2c-idx=\"1018\"></use></svg>"} />
                  </div>
                </div>
                <div className={styles["aion"]}>
                  <p className={styles["p"]}>{slots[0] ?? "Asset"}</p>
                </div>
              </a>
              <div className={styles["an-intelligent-workflow-platform-that-actively-supports-and-enhances-your-existing-financial-processes"]}>
                <p className={styles["p-36"]}>{slots[1] ?? "A marketplace of real web projects you can edit visually and leave with as code you own."}</p>
              </div>
            </div>
            <div className={styles["copyright-2026-aion-all-rights-reserved"]}>
              <p className={styles["p-37"]}>{slots[2] ?? "©2026 webcanbe - All rights reserved."}</p>
            </div>
          </div>
          <div className={styles["menu-2"]}>
            <div className={styles["column-2"]}>
              <div className={styles["navigation"]}>
                <h6 className={styles["h6-6"]}>{slots[3] ?? "Navigation"}</h6>
              </div>
              <div className={styles["items"]}>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./#overview">{slots[4] ?? "Overview"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./#features">{slots[5] ?? "Features"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./#integrations">{slots[6] ?? "Integrations"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./#benefits">{slots[7] ?? "Benefits"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./">{slots[8] ?? "Reviews"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./#pricing">{slots[9] ?? "Pricing"}</a>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["column-2"]}>
              <div className={styles["navigation"]}>
                <h6 className={styles["h6-6"]}>{slots[10] ?? "Information"}</h6>
              </div>
              <div className={styles["items"]}>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./">{slots[11] ?? "Compliance"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./#faq">{slots[12] ?? "FAQ"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./contact">{slots[13] ?? "Contact"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./privacy-policy">{slots[14] ?? "Privacy Policy"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="./404">{slots[15] ?? "404 Error"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="https://framer.link/CsDpB9T">{slots[16] ?? "Use Template"}</a>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["column-3"]}>
              <div className={styles["navigation"]}>
                <h6 className={styles["h6-6"]}>{slots[17] ?? "Socials"}</h6>
              </div>
              <div className={styles["items-2"]}>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="http://x.com/">{slots[18] ?? "Twitter (X)"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="https://www.instagram.com/">{slots[19] ?? "Instagram"}</a>
                  </div>
                </div>
                <div className={styles["overview-2"]}>
                  <div className={styles["p-38"]}>
                    <a className={styles["a-2"]} href="https://linkedin.com/">{slots[20] ?? "LinkedIn"}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
  )
}
