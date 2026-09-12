import styles from "./styles.module.css"
import States from "./States"

export default function Showcase({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["1-change-content-here"]}>
        <div className={styles["showcase-accordions"]}>
          <div className={styles["div-4"]}>
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
          </div>
          <div className={styles["div-5"]}>
            <States
              a={<>
                <div className={styles["closed-2"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator-2"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Move things on the canvas"}</h6>
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-2"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Move things on the canvas"}</h6>
                    </div>
                  </div>
                  <div className={styles["description-4"]}>
                    <p className={styles["p-15"]}>{"Drag, resize, restyle, reorder. Every change you make visually is written into the actual source files. Nothing is stored in a hidden format you can't read later."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-5"]}>
            <States
              a={<>
                <div className={styles["closed-2"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator-2"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Open the code whenever you want"}</h6>
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-3"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Open the code whenever you wantgents"}</h6>
                    </div>
                  </div>
                  <div className={styles["description-5"]}>
                    <p className={styles["p-16"]}>{"The editor sits right next to the canvas. Change a file by hand and the canvas reflects it. Two views of the same project, never out of sync."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-5"]}>
            <States
              a={<>
                <div className={styles["closed-2"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator-2"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Bring AI in when it helps"}</h6>
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-3"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Bring AI in when it helps"}</h6>
                    </div>
                  </div>
                  <div className={styles["description-5"]}>
                    <p className={styles["p-16"]}>{"Ask it to build a section, refactor a component, or wire up a page. It edits the same files you do — no separate preview, no throwaway output."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-5"]}>
            <States
              a={<>
                <div className={styles["closed-2"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator-2"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Take the codebase with you"}</h6>
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-3"]}>
                  <div className={styles["heading-4"]}>
                    <div className={styles["indicator"]} />
                    <div className={styles["title-4"]}>
                      <h6 className={styles["h6-4"]}>{"Take the codebase with youernal systems"}</h6>
                    </div>
                  </div>
                  <div className={styles["description-5"]}>
                    <p className={styles["p-16"]}>{"Download it and run it anywhere. Push to your own repo, deploy where you like, hire a developer later. Nothing breaks when you leave."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
        </div>
        <div className={styles["images"]}>
          <div className={styles["image-5-change-here"]}>
            <div className={styles["div-6"]}>
              <img className={styles["img"]} src={slots[0] ?? "https://framerusercontent.com/images/qPVP81K0e3qMeAitZENlogZUs.png?scale-down-to=1024&width=1584&height=1212"} alt="" />
            </div>
          </div>
          <div className={styles["image-5-change-here"]}>
            <div className={styles["div-6"]}>
              <img className={styles["img"]} src={slots[1] ?? "https://framerusercontent.com/images/n2xJW9lnHFw26Cc8MUkdpbDb948.png?scale-down-to=1024&width=1584&height=1212"} alt="" />
            </div>
          </div>
          <div className={styles["image-5-change-here"]}>
            <div className={styles["div-6"]}>
              <img className={styles["img"]} src={slots[2] ?? "https://framerusercontent.com/images/oPhC01aYCmXkEe03z4IgUGbHXNY.png?scale-down-to=1024&width=1584&height=1212"} alt="" />
            </div>
          </div>
          <div className={styles["image-5-change-here"]}>
            <div className={styles["div-6"]}>
              <img className={styles["img"]} src={slots[3] ?? "https://framerusercontent.com/images/kBHFlqra3gnj3omNXrtMMe3gK8.png?scale-down-to=1024&width=1584&height=1212"} alt="" />
            </div>
          </div>
          <div className={styles["image-1-change-here"]}>
            <div className={styles["div-6"]}>
              <img className={styles["img-2"]} src={slots[4] ?? "https://framerusercontent.com/images/oTzxnnsUi1rm7xRzjlEnNtJB3M.png?scale-down-to=1024&width=1448&height=1086"} alt="" />
            </div>
          </div>
        </div>
      </div>
  )
}
