import styles from "./styles.module.css"
import States from "./States"

export default function FAQAccordions({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default-9"]}>
        <div className={styles["div-18"]}>
          <div className={styles["div-3"]} />
        </div>
        <div className={styles["column"]}>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "646ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"How does the platform support investing workflows?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"How does the platform support investing workflows?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"Centralizes decisions, research, and execution so teams manage investing workflows faster with full visibility."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "751ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Is my financial data secure and compliant?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Is my financial data secure and compliant?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"Data is protected with encryption, governance controls, and compliance aligned with industry security standards."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "854ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Does the platform support custom models?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Does the platform support custom models?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"Yes, you can build, deploy, and manage custom models tailored to specific investment strategies."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "959ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Can I integrate existing data sources?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Can I integrate existing data sources?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"Integrate internal systems, external providers, and data tools through secure and flexible infrastructure connections."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
        </div>
        <div className={styles["column"]}>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "751ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"How does pricing scale for teams?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"How does pricing scale for teams?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"Plans scale with team size, advanced workflows, and infrastructure needs as organizations grow over time."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "854ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"What compliance standards does the platform meet?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"What compliance standards does the platform meet?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"The platform aligns with SOC2, ISO, GDPR, and CCPA to ensure strong regulatory compliance."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "959ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Can I automate workflows using financial agents?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"Can I automate workflows using financial agents?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"Yes, financial agents automate tasks, monitor signals, and execute workflows based on predefined logic."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
          <div className={styles["div-19"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1062ms" }}>
            <States
              a={<>
                <div className={styles["closed-3"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"How does collaboration work across teams?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-4"]} />
                    </div>
                  </div>
                </div>
              </>}
              b={<>
                <div className={styles["open-4"]}>
                  <div className={styles["heading-9"]}>
                    <div className={styles["title-7"]}>
                      <h6 className={styles["h6-5"]}>{"How does collaboration work across teams?"}</h6>
                    </div>
                    <div className={styles["icon-2"]}>
                      <div className={styles["indicator-5"]} />
                    </div>
                  </div>
                  <div className={styles["description-9"]}>
                    <p className={styles["p-35"]}>{"Teams collaborate through shared workflows, permissions, and centralized visibility across investing operations and research."}</p>
                  </div>
                </div>
              </>}
            />
          </div>
        </div>
      </div>
  )
}
