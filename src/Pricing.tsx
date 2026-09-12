import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function Pricing({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["monthly"]}>
        <div className={styles["container-4"]}>
          <div className={styles["monthly-2"]}>
            <p className={styles["p-21"]}>{slots[0] ?? "Monthly"}</p>
          </div>
          <div className={styles["switch"]}>
            <div className={styles["background"]} />
          </div>
          <div className={styles["yearly"]}>
            <p className={styles["p-22"]}>{slots[1] ?? "Yearly"}</p>
          </div>
          <div className={styles["badge"]}>
            <div className={styles["30-off"]}>
              <p className={styles["p-23"]}>{slots[2] ?? "2 months free"}</p>
            </div>
          </div>
        </div>
        <div className={styles["pricing-cards"]}>
          <div className={styles["pricing-card"]}>
            <div className={styles["content"]}>
              <div className={styles["heading-6"]}>
                <div className={styles["text-2"]}>
                  <div className={styles["starter"]}>
                    <h5 className={styles["h5-2"]}>{slots[3] ?? "Free"}</h5>
                  </div>
                  <div className={styles["start-investing-workflows-with-built-in-intelligence"]}>
                    <div className={styles["p-24"]}>
                      <strong className={styles["strong"]}>{slots[4] ?? "Everything you need to open a project, change it, and take it with you."}</strong>
                    </div>
                  </div>
                </div>
                <div className={styles["price"]}>
                  <div className={styles["div-12"]}>
                    <h3 className={styles["h3"]}>{slots[5] ?? "$0"}</h3>
                    <h3 className={styles["h3-2"]}>{slots[6] ?? "$0"}</h3>
                  </div>
                  <div className={styles["per-user-month"]}>
                    <p className={styles["p-25"]}>{slots[7] ?? "Forever"}</p>
                  </div>
                </div>
              </div>
              <div className={styles["divider"]} />
              <div className={styles["list"]}>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"697\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"698\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[8] ?? "Visual canvas editing"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"704\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"705\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[9] ?? "Full code editor"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"711\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"712\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[10] ?? "Export your codebase (every plan)"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"718\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"719\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[11] ?? "1 active workspace"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"725\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"726\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[12] ?? "Unlimited edits"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["div-14"]}>
              <a className={styles["primary-5"]}>
                <div className={styles["get-started-5"]}>
                  <p className={styles["p-27"]}>{slots[13] ?? "Start for free"}</p>
                </div>
              </a>
            </div>
          </div>
          <div className={styles["pricing-card-2"]}>
            <div className={styles["content-2"]}>
              <div className={styles["heading-7"]}>
                <div className={styles["text-3"]}>
                  <div className={styles["frame-1410129054"]}>
                    <div className={styles["starter-2"]}>
                      <h5 className={styles["h5-3"]}>{slots[14] ?? "Pro"}</h5>
                    </div>
                    <div className={styles["badge-2"]}>
                      <div className={styles["popular"]}>
                        <p className={styles["p-28"]}>{slots[15] ?? "Popular"}</p>
                      </div>
                    </div>
                  </div>
                  <div className={styles["start-investing-workflows-with-built-in-intelligence"]}>
                    <p className={styles["p-24"]}>{slots[16] ?? "For one person building one real thing. Everything unlocked except the team stuff."}</p>
                  </div>
                </div>
                <div className={styles["price"]}>
                  <div className={styles["div-12"]}>
                    <h3 className={styles["h3"]}>{slots[17] ?? "$19"}</h3>
                    <h3 className={styles["h3-2"]}>{slots[18] ?? "$19"}</h3>
                  </div>
                  <div className={styles["per-user-month"]}>
                    <p className={styles["p-25"]}>{slots[19] ?? "Per/month"}</p>
                  </div>
                </div>
              </div>
              <div className={styles["divider"]} />
              <div className={styles["list-2"]}>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"756\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"757\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[20] ?? "Everything in Free"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"763\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"764\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[21] ?? "Unlimited workspaces"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"770\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"771\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[22] ?? "AI editing — 500 requests/month"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"777\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"778\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[23] ?? "Connect a custom domain"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"784\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"785\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[24] ?? "One-click deploy"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"791\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"792\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[25] ?? "Version history, 30 days"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"798\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"799\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[26] ?? "Remove WebCanBe badge"}</p>
                  </div>
                </div>
                <div className={styles["item"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"805\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"806\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["automated-workflows"]}>
                    <p className={styles["p-26"]}>{slots[27] ?? "1:1 Email support"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["div-15"]}>
              <a className={styles["primary-6"]}>
                <div className={styles["get-started-6"]}>
                  <p className={styles["p-29"]}>{slots[28] ?? "Get Pro"}</p>
                </div>
              </a>
            </div>
          </div>
          <div className={styles["pricing-card-3"]}>
            <div className={styles["content-3"]}>
              <div className={styles["heading-8"]}>
                <div className={styles["text-4"]}>
                  <div className={styles["team"]}>
                    <h5 className={styles["h5-4"]}>{slots[29] ?? "Studio"}</h5>
                  </div>
                  <div className={styles["collaborate-across-teams-with-shared-investing-workflows"]}>
                    <p className={styles["p-30"]}>{slots[30] ?? "For freelancers, agencies, and anyone shipping more than one project at a time."}</p>
                  </div>
                </div>
                <div className={styles["price-2"]}>
                  <div className={styles["div-16"]}>
                    <h3 className={styles["h3-3"]}>{slots[31] ?? "$49"}</h3>
                    <h3 className={styles["h3-4"]}>{slots[32] ?? "$49"}</h3>
                  </div>
                  <div className={styles["per-user-month-2"]}>
                    <p className={styles["p-31"]}>{slots[33] ?? "Per/month"}</p>
                  </div>
                </div>
              </div>
              <div className={styles["divider-2"]} />
              <div className={styles["list-3"]}>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"832\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"833\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[34] ?? "Everything in Pro"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"839\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"840\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[35] ?? "5 team seats included"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"846\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"847\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[36] ?? "AI editing — 8,000 rquests/month"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"853\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"854\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["collaboration-workflows"]}>
                    <p className={styles["p-33"]}>{slots[37] ?? "Client handoff with full code"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"860\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"861\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[38] ?? "Sell projects on the marketplace"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"867\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"868\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[39] ?? "Version history, 1 year"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"874\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"875\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[40] ?? "Reduced marketplace fee"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"881\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"882\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[41] ?? "Multiple custom domains"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"888\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"889\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[42] ?? "Priority builds"}</p>
                  </div>
                </div>
                <div className={styles["item-2"]}>
                  <div className={styles["check"]}>
                    <div className={styles["div-13"]}>
                      <SvgGraphic className={styles["svg-3"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 16 16\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"895\"><use href=\"#svg-209854587_318\" data-f2c-idx=\"896\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["multi-user-access"]}>
                    <p className={styles["p-32"]}>{slots[43] ?? "Priority support"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["div-17"]}>
              <a className={styles["primary-7"]}>
                <div className={styles["get-started-7"]}>
                  <p className={styles["p-34"]}>{slots[44] ?? "Get studio"}</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
  )
}
