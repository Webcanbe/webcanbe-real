import styles from "./styles.module.css"
import RevealWatcher from "./RevealWatcher"
import { SvgGraphic } from "./RichText"
import Navigation from "./Navigation"
import Button from "./Button"
import SmoothScroll from "./SmoothScroll"
import Button2 from "./Button2"
import ActionCard from "./ActionCard"
import Boxes from "./Boxes"
import ActionCard2 from "./ActionCard2"
import SquareDashedMousePointer from "./SquareDashedMousePointer"
import ActionCard3 from "./ActionCard3"
import CodeXml from "./CodeXml"
import Showcase from "./Showcase"
import ShowcaseAccordion from "./ShowcaseAccordion"
import ContentCard from "./ContentCard"
import ContentCard2 from "./ContentCard2"
import LogosTicker from "./LogosTicker"
import LogoCard from "./LogoCard"
import IconCard from "./IconCard"
import Layers from "./Layers"
import FileCode2 from "./FileCode2"
import GitBranch from "./GitBranch"
import FileTerminal from "./FileTerminal"
import Globe from "./Globe"
import Users from "./Users"
import Button3 from "./Button3"
import Pricing from "./Pricing"
import AnimatedNumberCounter from "./AnimatedNumberCounter"
import Button4 from "./Button4"
import FAQAccordions from "./FAQAccordions"
import LayoutJumpPreventer from "./LayoutJumpPreventer"
import Footer from "./Footer"
import Layout2 from "./Layout2"
import Framer from "./Framer"
import Text from "./Text"
import Mails from "./Mails"
import Store from "./Store"
import FormButton from "./FormButton"

export default function Home({ slots = [] }: { slots?: string[] }) {
  return (
    <>
      <RevealWatcher />
      <div className={styles["div-22"]}>
        <div className={styles["div-23"]}>
          <div className={styles["div-24"]}>
            <div className={styles["div-25"]}>
              <Navigation slots={["Asset","Overview","Features","Integrations","Benefits","About","Reviews","Pricing","Get started"]} />
            </div>
          </div>
          <div className={styles["div-26"]}>
            <div className={styles["div-27"]}>
              <SmoothScroll slots={[]} />
            </div>
            <header className={styles["hero"]}>
              <div className={styles["dots"]}>
                <div className={styles["div-28"]}>
                  <img className={styles["img-5"]} src={slots[0] ?? "https://framerusercontent.com/images/zPRaBFP7xkHnnH5NTRJcBW4FPc.png?scale-down-to=1024&width=2602&height=1566"} alt="" />
                </div>
              </div>
              <div className={styles["header"]}>
                <div className={styles["heading-10"]}>
                  <div className={styles["container-6"]}>
                    <div className={styles["tag"]}>
                      <div className={styles["indicator-6"]} />
                      <div className={styles["text-6"]}>
                        <p className={styles["p-40"]}>{slots[1] ?? "Real projects. Real code."}</p>
                      </div>
                    </div>
                    <div className={styles["text-7"]}>
                      <div className={styles["title-8"]}>
                        <h1 className={styles["h1"]}>
                          <span className={styles["span"]}>{slots[2] ?? "Every"}</span>
                          {" "}
                          <span className={styles["span-2"]}>{slots[3] ?? "visual"}</span>
                          {" "}
                          <span className={styles["span-3"]}>{slots[4] ?? "tool"}</span>
                          {" "}
                          <span className={styles["span-4"]}>{slots[5] ?? "hides"}</span>
                          {" "}
                          <span className={styles["span-5"]}>{slots[6] ?? "the"}</span>
                          {" "}
                          <span className={styles["span"]}>{slots[7] ?? "code."}</span>
                          {" "}
                          <span className={styles["span-6"]}>{slots[8] ?? "This"}</span>
                          {" "}
                          <span className={styles["span-7"]}>{slots[9] ?? "one"}</span>
                          {" "}
                          <span className={styles["span-8"]}>{slots[10] ?? "hands"}</span>
                          {" "}
                          <span className={styles["span-9"]}>{slots[11] ?? "it"}</span>
                          {" "}
                          <span className={styles["span-10"]}>{slots[12] ?? "to"}</span>
                          {" "}
                          <span className={styles["span-11"]}>{slots[13] ?? "you."}</span>
                        </h1>
                      </div>
                      <div className={styles["description-11"]}>
                        <div className={styles["p-41"]}>
                          <span className={styles["span-12"]}>{slots[14] ?? "Start"}</span>
                          {" "}
                          <span className={styles["span-13"]}>{slots[15] ?? "from"}</span>
                          {" "}
                          <span className={styles["span-14"]}>{slots[16] ?? "a"}</span>
                          {" "}
                          <span className={styles["span-15"]}>{slots[17] ?? "real"}</span>
                          {" "}
                          <span className={styles["span-16"]}>{slots[18] ?? "project,"}</span>
                          {" "}
                          <span className={styles["span-17"]}>{slots[19] ?? "not"}</span>
                          {" "}
                          <span className={styles["span-14"]}>{slots[20] ?? "a"}</span>
                          {" "}
                          <span className={styles["span-18"]}>{slots[21] ?? "blank"}</span>
                          {" "}
                          <span className={styles["span-19"]}>{slots[22] ?? "page."}</span>
                          {" "}
                          <span className={styles["span-20"]}>{slots[23] ?? "Move"}</span>
                          {" "}
                          <span className={styles["span-21"]}>{slots[24] ?? "things"}</span>
                          {" "}
                          <span className={styles["span-22"]}>{slots[25] ?? "on"}</span>
                          {" "}
                          <span className={styles["span-17"]}>{slots[26] ?? "the"}</span>
                          {" "}
                          <span className={styles["span-23"]}>{slots[27] ?? "canvas"}</span>
                          {" "}
                          <span className={styles["span-24"]}>{slots[28] ?? "and"}</span>
                          {" "}
                          <span className={styles["span-17"]}>{slots[29] ?? "the"}</span>
                          {" "}
                          <span className={styles["span-25"]}>{slots[30] ?? "source"}</span>
                          {" "}
                          <span className={styles["span-26"]}>{slots[31] ?? "code"}</span>
                          {" "}
                          <span className={styles["span-27"]}>{slots[32] ?? "changes"}</span>
                          {" "}
                          <span className={styles["span-28"]}>{slots[33] ?? "with"}</span>
                          {" "}
                          <span className={styles["span-29"]}>{slots[34] ?? "it."}</span>
                          {" "}
                          <span className={styles["span-30"]}>{slots[35] ?? "Take"}</span>
                          {" "}
                          <span className={styles["span-31"]}>{slots[36] ?? "it"}</span>
                          {" "}
                          <span className={styles["span-32"]}>{slots[37] ?? "anywhere,"}</span>
                          {" "}
                          <span className={styles["span-33"]}>{slots[38] ?? "anytime."}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["actions"]}>
                    <div className={styles["div-29"]}>
                      <Button2 slots={["Open a project"]} />
                    </div>
                    <div className={styles["div-30"]}>
                      <Button2 slots={["See how it works"]} />
                    </div>
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["image-2"]}>
                    <div className={styles["div-31"]}>
                      <img className={styles["img-6"]} src={slots[39] ?? "https://framerusercontent.com/images/Sh880sHyNnkevnmfd0Pd1wSthI.png?scale-down-to=1024&width=7136&height=3840"} alt="" />
                    </div>
                  </div>
                </div>
                <div className={styles["action-cards"]}>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-32"] + " " + styles["rv-3"]} data-reveal>
                      <ActionCard slots={["Start from something real","Pick a project that already runs.       No blank page, no setup."]} />
                    </div>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-33"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "106ms" }}>
                      <ActionCard2 slots={["Drag a box, change the code","Canvas edits write straight into the source code. No prompting."]} />
                    </div>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-34"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "210ms" }}>
                      <ActionCard3 slots={["Canvas, code, or AI","Three ways in. One codebase underneath. No hand-off."]} />
                    </div>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-35"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "315ms" }}>
                      <ActionCard slots={["It was never ours to keep","Download the codebase and run it anywhere you want."]} />
                    </div>
                  </div>
                </div>
              </div>
            </header>
            <section className={styles["overview-3"]}>
              <div className={styles["heading-11"]}>
                <div className={styles["tag-2"] + " " + styles["rv-2"]} data-reveal>
                  <div className={styles["indicator-7"]} />
                  <div className={styles["text-8"]}>
                    <p className={styles["p-42"]}>{slots[40] ?? "One project, four ways in"}</p>
                  </div>
                </div>
                <div className={styles["text-9"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "786ms" }}>
                  <div className={styles["title-9"]}>
                    <h2 className={styles["h2"]}>{slots[41] ?? "Visual, code, and AI —  editing the same files"}</h2>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["description-12"]}>
                      <p className={styles["p-43"]}>{slots[42] ?? "Three ways to edit, one codebase underneath. Whatever you touch, the files change."}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["div-25"]}>
                <div className={styles["div-36"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "603ms" }}>
                  <Showcase slots={["Pick a project that already runs","Browse real projects, not screenshots. Open one and it's already running — routes, components, styles, all of it. Your starting point is a working codebase, not a zip file.","Move things on the canvas","Open the code whenever you want","Bring AI in when it helps","Take the codebase with you","https://framerusercontent.com/images/qPVP81K0e3qMeAitZENlogZUs.png?scale-down-to=1024&width=1584&height=1212","https://framerusercontent.com/images/n2xJW9lnHFw26Cc8MUkdpbDb948.png?scale-down-to=1024&width=1584&height=1212","https://framerusercontent.com/images/oPhC01aYCmXkEe03z4IgUGbHXNY.png?scale-down-to=1024&width=1584&height=1212","https://framerusercontent.com/images/kBHFlqra3gnj3omNXrtMMe3gK8.png?scale-down-to=1024&width=1584&height=1212","https://framerusercontent.com/images/oTzxnnsUi1rm7xRzjlEnNtJB3M.png?scale-down-to=1024&width=1448&height=1086"]} />
                </div>
              </div>
            </section>
            <section className={styles["features-2"]}>
              <div className={styles["dots-2"] + " " + styles["rv-4"]} data-reveal style={{ transitionDelay: "418ms" }}>
                <div className={styles["div-37"]}>
                  <img className={styles["img-7"]} src={slots[43] ?? "https://framerusercontent.com/images/zPRaBFP7xkHnnH5NTRJcBW4FPc.png?scale-down-to=1024&width=2602&height=1566"} alt="" />
                </div>
              </div>
              <div className={styles["heading-11"]}>
                <div className={styles["tag-3"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1153ms" }}>
                  <div className={styles["indicator-8"]} />
                  <div className={styles["text-10"]}>
                    <p className={styles["p-44"]}>{slots[44] ?? "Marketplace"}</p>
                  </div>
                </div>
                <div className={styles["text-9"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "208ms" }}>
                  <div className={styles["title-10"]}>
                    <h2 className={styles["h2-2"]}>{slots[45] ?? "Not templates. Starting points."}</h2>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["description-13"]}>
                      <p className={styles["p-45"]}>{slots[46] ?? "Every project here is a working codebase, built to be opened and edited — not downloaded and figured out."}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["content-cards"]}>
                <div className={styles["div-25"]}>
                  <div className={styles["div-38"] + " " + styles["rv-2"]} data-reveal>
                    <ContentCard slots={["https://framerusercontent.com/images/QdBy8tuSCKn7z4p2vBgdPbChluY.png?scale-down-to=512&width=1056&height=808","Built to be edited","Every project follows the same structure,       so the canvas works on all of them."]} />
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-39"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "208ms" }}>
                    <ContentCard2 slots={["https://framerusercontent.com/images/e47XRTAfjoGkAOkb5PtDjlPw.png?scale-down-to=512&width=1056&height=808","Open it, don't unzip it","Purchase goes straight into a workspace. No local setup before you can change a thing."]} />
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-38"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "418ms" }}>
                    <ContentCard slots={["https://framerusercontent.com/images/67kmPP65EuLM3xQS7RKVlvYzak.png?scale-down-to=512&width=1056&height=808","Yours after purchase","Buy once, keep the code. No seat fees,       no export tier, no expiring license."]} />
                  </div>
                </div>
              </div>
            </section>
            <section className={styles["integrations-2"]}>
              <div className={styles["container-7"]}>
                <div className={styles["heading-12"]}>
                  <div className={styles["tag-4"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "600ms" }}>
                    <div className={styles["indicator-7"]} />
                    <div className={styles["text-11"]}>
                      <p className={styles["p-46"]}>{slots[47] ?? "Works with"}</p>
                    </div>
                  </div>
                  <div className={styles["text-12"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "184ms" }}>
                    <div className={styles["title-11"]}>
                      <h2 className={styles["h2-3"]}>{slots[48] ?? "It runs where you run it"}</h2>
                    </div>
                    <div className={styles["description-14"]}>
                      <p className={styles["p-47"]}>{slots[49] ?? "Push it to your own repo. Deploy it on your own host. Open it in your own editor. Nothing here is locked to us."}</p>
                    </div>
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-29"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "184ms" }}>
                    <Button2 slots={["Open a project"]} />
                  </div>
                </div>
              </div>
              <div className={styles["div-25"]}>
                <div className={styles["div-40"]}>
                  <LogosTicker slots={["https://framerusercontent.com/images/EEj4wGO65VnHSf2Tx0kTo9JeVCg.png?width=256&height=256","https://framerusercontent.com/images/PZZBOiNnER8p6iEbZfvJiXsdg.png?width=256&height=256","https://framerusercontent.com/images/YJlv4WzdLjfRUQSOsnj1ib1d88c.png?width=256&height=256","https://framerusercontent.com/images/V8vFhIZVjm7nJlBuOJ44W5HzJg.png?width=256&height=256","https://framerusercontent.com/images/ed9V9yLMrGPNyLyKxMlhlDW3tGI.png?width=256&height=256","https://framerusercontent.com/images/5y77SUskenLyvkKRDVjJTgHlBxM.png?width=256&height=256","https://framerusercontent.com/images/SdSj5jVyQipnYBABqZRI4xvQ.png?width=256&height=256","https://framerusercontent.com/images/DpnhjqAn2VvXJTnCNiKGZBpHQ.png?width=256&height=256","https://framerusercontent.com/images/v5LKosv7fWAvUq572jffiBMmQfM.png?width=256&height=256","https://framerusercontent.com/images/EEj4wGO65VnHSf2Tx0kTo9JeVCg.png?width=256&height=256","https://framerusercontent.com/images/PZZBOiNnER8p6iEbZfvJiXsdg.png?width=256&height=256","https://framerusercontent.com/images/YJlv4WzdLjfRUQSOsnj1ib1d88c.png?width=256&height=256","https://framerusercontent.com/images/V8vFhIZVjm7nJlBuOJ44W5HzJg.png?width=256&height=256","https://framerusercontent.com/images/ed9V9yLMrGPNyLyKxMlhlDW3tGI.png?width=256&height=256","https://framerusercontent.com/images/5y77SUskenLyvkKRDVjJTgHlBxM.png?width=256&height=256","https://framerusercontent.com/images/SdSj5jVyQipnYBABqZRI4xvQ.png?width=256&height=256","https://framerusercontent.com/images/DpnhjqAn2VvXJTnCNiKGZBpHQ.png?width=256&height=256","https://framerusercontent.com/images/v5LKosv7fWAvUq572jffiBMmQfM.png?width=256&height=256","https://framerusercontent.com/images/EEj4wGO65VnHSf2Tx0kTo9JeVCg.png?width=256&height=256","https://framerusercontent.com/images/PZZBOiNnER8p6iEbZfvJiXsdg.png?width=256&height=256","https://framerusercontent.com/images/YJlv4WzdLjfRUQSOsnj1ib1d88c.png?width=256&height=256","https://framerusercontent.com/images/V8vFhIZVjm7nJlBuOJ44W5HzJg.png?width=256&height=256","https://framerusercontent.com/images/ed9V9yLMrGPNyLyKxMlhlDW3tGI.png?width=256&height=256","https://framerusercontent.com/images/5y77SUskenLyvkKRDVjJTgHlBxM.png?width=256&height=256","https://framerusercontent.com/images/SdSj5jVyQipnYBABqZRI4xvQ.png?width=256&height=256","https://framerusercontent.com/images/DpnhjqAn2VvXJTnCNiKGZBpHQ.png?width=256&height=256","https://framerusercontent.com/images/v5LKosv7fWAvUq572jffiBMmQfM.png?width=256&height=256","https://framerusercontent.com/images/EEj4wGO65VnHSf2Tx0kTo9JeVCg.png?width=256&height=256","https://framerusercontent.com/images/PZZBOiNnER8p6iEbZfvJiXsdg.png?width=256&height=256","https://framerusercontent.com/images/YJlv4WzdLjfRUQSOsnj1ib1d88c.png?width=256&height=256","https://framerusercontent.com/images/V8vFhIZVjm7nJlBuOJ44W5HzJg.png?width=256&height=256","https://framerusercontent.com/images/ed9V9yLMrGPNyLyKxMlhlDW3tGI.png?width=256&height=256","https://framerusercontent.com/images/5y77SUskenLyvkKRDVjJTgHlBxM.png?width=256&height=256","https://framerusercontent.com/images/SdSj5jVyQipnYBABqZRI4xvQ.png?width=256&height=256","https://framerusercontent.com/images/DpnhjqAn2VvXJTnCNiKGZBpHQ.png?width=256&height=256","https://framerusercontent.com/images/v5LKosv7fWAvUq572jffiBMmQfM.png?width=256&height=256"]} />
                </div>
              </div>
            </section>
            <section className={styles["benefits-2"]}>
              <div className={styles["dots-3"]}>
                <div className={styles["div-37"]}>
                  <img className={styles["img-7"]} src={slots[50] ?? "https://framerusercontent.com/images/zPRaBFP7xkHnnH5NTRJcBW4FPc.png?scale-down-to=1024&width=2602&height=1566"} alt="" />
                </div>
              </div>
              <div className={styles["heading-13"]}>
                <div className={styles["tag-5"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "589ms" }}>
                  <div className={styles["indicator-9"]} />
                  <div className={styles["text-13"]}>
                    <p className={styles["p-48"]}>{slots[51] ?? "Under the hood"}</p>
                  </div>
                </div>
                <div className={styles["text-12"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "772ms" }}>
                  <div className={styles["title-11"]}>
                    <h2 className={styles["h2-3"]}>{slots[52] ?? "A codebase, not a black box"}</h2>
                  </div>
                  <div className={styles["description-15"]}>
                    <p className={styles["p-49"]}>{slots[53] ?? "What you download is a normal project. Anyone who knows the stack can pick it up and keep going."}</p>
                  </div>
                </div>
              </div>
              <div className={styles["icon-cards"]}>
                <div className={styles["div-25"]}>
                  <div className={styles["div-41"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "589ms" }}>
                    <IconCard slots={["Standard stack","Familiar frameworks and conventions.    Nothing proprietary to learn."]} />
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-41"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "669ms" }}>
                    <IconCard slots={["Readable output","Named components, real file structure.    Not generated soup."]} />
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-42"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "772ms" }}>
                    <IconCard slots={["Version control ready","Push to your own repo from day one.    Branch and review like any project."]} />
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-41"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1453ms" }}>
                    <IconCard slots={["Runs locally","Clone it, install it, start it.                           No platform runtime required."]} />
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-41"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1534ms" }}>
                    <IconCard slots={["Deploy anywhere","Your host, your domain, your account.    We're not in the path."]} />
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["div-42"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1638ms" }}>
                    <IconCard slots={["Hand it off","Bring in a developer later and they start working, not rebuilding."]} />
                  </div>
                </div>
              </div>
            </section>
            <section className={styles["about-2"]}>
              <div className={styles["heading-11"]}>
                <div className={styles["tag-6"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1138ms" }}>
                  <div className={styles["indicator-7"]} />
                  <div className={styles["text-14"]}>
                    <p className={styles["p-50"]}>{slots[54] ?? "Workspace"}</p>
                  </div>
                </div>
                <div className={styles["text-9"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1927ms" }}>
                  <div className={styles["title-12"]}>
                    <h2 className={styles["h2-4"]}>{slots[55] ?? "Everything in one place, until you don't need us"}</h2>
                  </div>
                  <div className={styles["description-16"]}>
                    <p className={styles["p-51"]}>{slots[56] ?? "Edit, preview, and ship from the same screen. The moment you want out, the code comes with you."}</p>
                  </div>
                </div>
              </div>
              <div className={styles["section-2"]}>
                <div className={styles["div-25"]}>
                  <div className={styles["image-3"] + " " + styles["rv-5"]} data-reveal style={{ transitionDelay: "1718ms" }}>
                    <div className={styles["div-43"]}>
                      <img className={styles["img-8"]} src={slots[57] ?? "https://framerusercontent.com/images/QDJ1llyOwMGAxYkNFYaMteHdafs.png?scale-down-to=512&width=1584&height=1212"} alt="" />
                    </div>
                  </div>
                </div>
                <div className={styles["content-4"] + " " + styles["rv-6"]} data-reveal style={{ transitionDelay: "1718ms" }}>
                  <div className={styles["text-15"]}>
                    <div className={styles["title-13"]}>
                      <h3 className={styles["h3-5"]}>{slots[58] ?? "Canvas and code, side by side"}</h3>
                    </div>
                    <div className={styles["description-17"]}>
                      <p className={styles["p-52"]}>{slots[59] ?? "Move something on the canvas and watch the file       change next to it. One screen, no switching."}</p>
                    </div>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-44"]}>
                      <Button2 slots={["Explore editing"]} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["section-2"]}>
                <div className={styles["content-5"] + " " + styles["rv-5"]} data-reveal style={{ transitionDelay: "2322ms" }}>
                  <div className={styles["text-16"]}>
                    <div className={styles["title-14"]}>
                      <h3 className={styles["h3-6"]}>{slots[60] ?? "Preview before you ship"}</h3>
                    </div>
                    <div className={styles["description-17"]}>
                      <p className={styles["p-52"]}>{slots[61] ?? "See the real thing running, not a render of it. What you preview is what deploys."}</p>
                    </div>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-45"]}>
                      <Button2 slots={["Explore preview"]} />
                    </div>
                  </div>
                </div>
                <div className={styles["div-25"]}>
                  <div className={styles["image-3"] + " " + styles["rv-6"]} data-reveal style={{ transitionDelay: "2322ms" }}>
                    <div className={styles["div-43"]}>
                      <img className={styles["img-8"]} src={slots[62] ?? "https://framerusercontent.com/images/1syVCCkaDxIa5Biljiq5qTfVq4.png?scale-down-to=512&width=1584&height=1212"} alt="" />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["section-2"]}>
                <div className={styles["div-25"]}>
                  <div className={styles["image-3"] + " " + styles["rv-5"]} data-reveal>
                    <div className={styles["div-43"]}>
                      <img className={styles["img-8"]} src={slots[63] ?? "https://framerusercontent.com/images/Vxk0TjEzBS4JnSawHN0ewFifdU.png?scale-down-to=512&width=1584&height=1212"} alt="" />
                    </div>
                  </div>
                </div>
                <div className={styles["content-5"] + " " + styles["rv-6"]} data-reveal>
                  <div className={styles["text-16"]}>
                    <div className={styles["title-14"]}>
                      <h3 className={styles["h3-6"]}>{slots[64] ?? "AI that edits the same files"}</h3>
                    </div>
                    <div className={styles["description-17"]}>
                      <p className={styles["p-52"]}>{slots[65] ?? "Ask for a section or a refactor. It writes into your       project, not into a separate preview you can't keep."}</p>
                    </div>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-46"]}>
                      <Button3 slots={["Explore AI"]} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section className={styles["pricing-2"]}>
              <div className={styles["heading-14"]}>
                <div className={styles["tag-7"] + " " + styles["rv-2"]} data-reveal>
                  <div className={styles["indicator-8"]} />
                  <div className={styles["text-17"]}>
                    <p className={styles["p-53"]}>{slots[66] ?? "Transparent Pricing"}</p>
                  </div>
                </div>
                <div className={styles["text-18"] + " " + styles["rv-2"]} data-reveal>
                  <div className={styles["title-15"]}>
                    <h2 className={styles["h2-5"]}>{slots[67] ?? "The code is free. The starting point isn't."}</h2>
                  </div>
                  <div className={styles["description-18"]}>
                    <p className={styles["p-54"]}>{slots[68] ?? "Exporting your codebase is never behind a plan. You pay for       projects and for the workspace around them — never for the       right to leave with what you made."}</p>
                  </div>
                </div>
              </div>
              <div className={styles["div-25"]}>
                <div className={styles["div-47"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "362ms" }}>
                  <Pricing slots={["Monthly","Yearly","2 months free","Free","Everything you need to open a project, change it, and take it with you.","$0","$0","Forever","Visual canvas editing","Full code editor","Export your codebase (every plan)","1 active workspace","Unlimited edits","Start for free","Pro","Popular","For one person building one real thing. Everything unlocked except the team stuff.","$19","$19","Per/month","Everything in Free","Unlimited workspaces","AI editing — 500 requests/month","Connect a custom domain","One-click deploy","Version history, 30 days","Remove WebCanBe badge","1:1 Email support","Get Pro","Studio","For freelancers, agencies, and anyone shipping more than one project at a time.","$49","$49","Per/month","Everything in Pro","5 team seats included","AI editing — 8,000 rquests/month","Client handoff with full code","Sell projects on the marketplace","Version history, 1 year","Reduced marketplace fee","Multiple custom domains","Priority builds","Priority support","Get studio"]} />
                </div>
              </div>
              <div className={styles["description-19"]}>
                <p className={styles["p-55"]}>{slots[69] ?? "Projects are priced individually, one time. Buy once and the code is"}</p>
                <p className={styles["p-56"]}>{slots[70] ?? "yours on every plan — including Free. No export tier, no expiring license."}</p>
              </div>
            </section>
            <section className={styles["faq"]}>
              <div className={styles["heading-11"]}>
                <div className={styles["tag-8"] + " " + styles["rv-2"]} data-reveal>
                  <div className={styles["indicator-9"]} />
                  <div className={styles["text-19"]}>
                    <p className={styles["p-57"]}>{slots[71] ?? "Questions"}</p>
                  </div>
                </div>
                <div className={styles["text-9"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "180ms" }}>
                  <div className={styles["title-16"]}>
                    <h2 className={styles["h2-6"]}>{slots[72] ?? "Everything you'd ask before trusting us with a project"}</h2>
                  </div>
                  <div className={styles["description-12"]}>
                    <p className={styles["p-43"]}>{slots[73] ?? "What you get, what you keep, and what happens when you decide to leave."}</p>
                  </div>
                </div>
              </div>
              <div className={styles["div-25"]}>
                <div className={styles["div-48"]}>
                  <FAQAccordions slots={["How does the platform support investing workflows?","Is my financial data secure and compliant?","Does the platform support custom models?","Can I integrate existing data sources?","How does pricing scale for teams?","What compliance standards does the platform meet?","Can I automate workflows using financial agents?","How does collaboration work across teams?"]} />
                </div>
              </div>
            </section>
            <section className={styles["cta-2"] + " " + styles["rv-2"]} data-reveal style={{ transitionDelay: "1114ms" }}>
              <div className={styles["div-25"]}>
                <div className={styles["dots-4"]}>
                  <div className={styles["div-49"]}>
                    <img className={styles["img-9"]} src={slots[74] ?? "https://framerusercontent.com/images/zPRaBFP7xkHnnH5NTRJcBW4FPc.png?scale-down-to=1024&width=2602&height=1566"} alt="" />
                  </div>
                </div>
              </div>
              <div className={styles["container-8"]}>
                <div className={styles["content-6"]}>
                  <div className={styles["text-20"]}>
                    <div className={styles["tag-9"]}>
                      <div className={styles["indicator-6"]} />
                      <div className={styles["text-21"]}>
                        <p className={styles["p-58"]}>{slots[75] ?? "Get started"}</p>
                      </div>
                    </div>
                    <div className={styles["move-investing-forward-with-intelligence"]}>
                      <h2 className={styles["h2-7"]}>{slots[76] ?? "Open a project. Change one thing. Watch the code."}</h2>
                    </div>
                    <div className={styles["div-25"]}>
                      <div className={styles["start-building-smarter-investing-workflows-with-secure-infrastructure-and-financial-agents"]}>
                        <p className={styles["p-59"]}>{slots[77] ?? "Start free. Export whenever you want. Nothing here is locked to us."}</p>
                      </div>
                    </div>
                  </div>
                  <div className={styles["div-25"]}>
                    <div className={styles["div-29"]}>
                      <Button2 slots={["Open a project"]} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["div-25"]}>
                <div className={styles["image-4"]}>
                  <div className={styles["div-50"]}>
                    <img className={styles["img-10"]} src={slots[78] ?? "https://framerusercontent.com/images/WhBcHipWpIPrspcMWOX2lGi4dQ.png?scale-down-to=512&width=1056&height=808"} alt="" />
                  </div>
                </div>
              </div>
            </section>
          </div>
          <div className={styles["div-51"]} />
          <div className={styles["div-52"]} />
          <div className={styles["div-25"]}>
            <div className={styles["div-53"]}>
              <Footer slots={["Asset","A marketplace of real web projects you can edit visually and leave with as code you own.","©2026 webcanbe - All rights reserved.","Navigation","Overview","Features","Integrations","Benefits","Reviews","Pricing","Information","Compliance","FAQ","Contact","Privacy Policy","404 Error","Use Template","Socials","Twitter (X)","Instagram","LinkedIn"]} />
            </div>
          </div>
        </div>
        <Layout2 slots={[]} />
      </div>
      <div className={styles["div-54"]}>
        <a className={styles["light"]} href="https://www.framer.com">
          <div className={styles["backdrop"]} />
          <div className={styles["content-7"]}>
            <div className={styles["div-55"]}>
              <Framer slots={[]} />
            </div>
            <p className={styles["p-60"]}>{slots[0] ?? "Create a free website with Framer, the website builder loved by startups, designers and agencies."}</p>
            <Text slots={[]} />
          </div>
          <div className={styles["bottom"]} />
          <div className={styles["border"]} />
        </a>
      </div>
      <div className={styles["div-56"]}>
        <SvgGraphic className={styles["svg-4"]} html={"<svg viewBox=\"0 0 20 20\" id=\"svg10927535637\" data-f2c-idx=\"1112\"><path d=\"M 13.12 14.756 C 11.424 14.597 9.815 14.934 8.467 15.721 C 7.524 16.257 6.697 17.046 5.992 17.944 L 5.517 18.638 L 5.388 18.862 L 5.879 19.108 C 5.923 19.096 5.935 19.14 5.991 19.173 C 6.103 19.237 6.202 19.258 6.358 19.31 L 6.67 19.416 L 6.875 19.125 C 6.907 19.069 6.972 18.957 7.048 18.889 C 7.664 18.015 8.427 17.338 9.294 16.869 C 10.401 16.242 11.69 15.943 13.098 16.085 C 14.261 16.198 16.55 16.104 18.854 14.305 L 18.931 14.237 L 19.027 14.07 C 19.016 14.025 19.06 14.014 19.092 13.958 C 19.241 13.634 19.391 13.311 19.485 12.955 L 20 11.352 L 18.802 12.524 C 17.039 14.225 15.203 14.954 13.12 14.756 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"1113\"></path><path d=\"M 5.809 11.615 C 6.916 10.987 8.206 10.688 9.613 10.831 C 11.165 10.981 14.978 10.762 18.052 6.016 L 18.697 4.898 L 18.55 4.701 C 18.459 4.536 18.312 4.34 18.165 4.143 L 17.779 3.585 L 17.457 4.144 C 17.436 4.244 17.36 4.311 17.295 4.423 C 15.888 6.927 13.435 9.758 9.668 9.446 C 7.972 9.286 6.362 9.624 5.015 10.41 C 3.711 11.185 2.678 12.265 1.816 13.631 L 1.804 13.587 L 1.332 14.469 C 1.344 14.513 1.3 14.525 1.267 14.581 L 1.171 14.749 L 1.262 14.913 C 1.365 15.122 1.512 15.319 1.615 15.527 L 2.068 16.162 L 2.355 15.47 C 2.376 15.37 2.452 15.303 2.473 15.203 C 3.174 14.117 4.133 12.584 5.809 11.615 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"1114\"></path><path d=\"M 1.323 11.967 C 2.053 10.638 3.022 9.669 4.161 8.986 C 5.268 8.358 6.558 8.059 7.965 8.201 C 12.32 8.593 15.119 5.29 16.275 3.61 L 16.694 2.884 L 16.867 2.648 L 16.62 2.431 C 16.453 2.334 16.317 2.181 16.138 2.041 L 15.779 1.759 L 15.554 2.15 C 15.521 2.206 15.457 2.318 15.425 2.374 C 14.046 4.633 11.666 7.209 8.075 6.849 C 6.38 6.69 4.77 7.027 3.422 7.814 C 2.568 8.326 1.805 9.003 1.077 9.813 L 0.352 10.81 C 0.288 10.922 0.256 10.978 0.191 11.09 L 0.127 11.202 L 0.162 11.334 C 0.201 11.654 0.283 11.963 0.31 12.239 L 0.561 13.353 L 1.097 12.359 C 1.162 12.247 1.215 12.091 1.323 11.967 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"1115\"></path><path d=\"M 15.2 17.412 C 15.056 17.403 14.956 17.383 14.812 17.374 C 13.116 17.214 11.507 17.551 10.159 18.338 C 9.874 18.509 9.589 18.68 9.316 18.895 L 8.389 19.664 L 8.16 19.867 L 9.124 19.939 C 9.412 19.957 9.7 19.974 9.988 19.991 L 10.132 20 L 10.252 19.92 C 10.372 19.841 10.481 19.717 10.613 19.682 C 10.701 19.658 10.777 19.59 10.854 19.523 C 11.84 18.974 12.986 18.667 14.326 18.733 C 14.47 18.742 14.57 18.762 14.714 18.771 L 14.957 18.8 L 15.078 18.721 C 15.363 18.55 15.691 18.367 15.921 18.164 L 17.036 17.392 L 15.676 17.426 C 15.532 17.417 15.344 17.42 15.2 17.412 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"1116\"></path><path d=\"M 19.498 6.478 L 19.014 7.317 C 18.95 7.429 18.885 7.54 18.821 7.652 C 17.475 9.856 15.062 12.487 11.472 12.127 C 9.776 11.968 8.166 12.305 6.819 13.092 C 5.559 13.855 4.514 14.891 3.696 16.245 L 3.288 17.015 L 3.171 17.283 L 3.418 17.5 C 3.598 17.641 3.721 17.75 3.856 17.903 L 4.227 18.228 L 4.429 17.749 C 4.461 17.693 4.526 17.581 4.558 17.525 C 5.309 16.096 6.266 15.083 7.493 14.376 C 8.6 13.748 9.889 13.45 11.297 13.592 C 12.505 13.693 13.685 13.518 14.796 13.079 C 16.763 12.315 18.483 10.625 19.639 8.945 C 19.703 8.833 19.78 8.765 19.844 8.653 L 19.941 8.486 L 19.906 8.353 C 19.835 8.089 19.796 7.768 19.726 7.504 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"1117\"></path><path d=\"M 1.67 6.913 C 1.899 6.71 2.184 6.539 2.425 6.38 C 3.532 5.752 4.821 5.454 6.229 5.596 C 7.149 5.68 8.021 5.588 8.946 5.34 C 10.797 4.843 12.47 3.686 13.846 1.946 L 14.539 1.005 L 14.059 0.803 C 13.892 0.706 13.68 0.621 13.48 0.58 L 13.169 0.474 L 12.996 0.71 C 12.919 0.778 12.899 0.878 12.823 0.945 C 10.96 3.335 8.754 4.446 6.327 4.199 C 4.588 4.052 2.966 4.345 1.51 5.255 C 1.389 5.335 1.269 5.414 1.105 5.506 L 1.028 5.573 L 0.932 5.741 C 0.943 5.785 0.899 5.797 0.867 5.853 C 0.762 6.165 0.6 6.444 0.495 6.756 L 0 8.259 L 1.177 7.187 C 1.397 7.128 1.55 6.993 1.67 6.913 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"1118\"></path><path d=\"M 4.481 2.947 L 4.625 2.956 C 5.257 3.023 6.197 3.007 7.298 2.711 C 8.444 2.404 9.475 1.844 10.458 1.108 L 11.647 0.08 L 10.639 0.019 C 10.351 0.002 10.063 -0.015 9.743 0.023 L 9.61 0.059 L 9.49 0.138 C 9.37 0.218 9.261 0.341 9.141 0.421 C 7.949 1.261 6.651 1.703 5.279 1.693 C 5.135 1.685 4.991 1.676 4.847 1.667 L 4.703 1.659 L 4.582 1.738 C 4.342 1.897 4.101 2.056 3.872 2.26 L 2.977 2.973 L 4.117 2.998 C 4.193 2.93 4.337 2.939 4.481 2.947 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"1119\"></path></svg>"} />
        <SvgGraphic className={styles["svg-5"]} html={"<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" id=\"svg-209854587_318\" data-f2c-idx=\"1120\">\n<rect width=\"16\" height=\"16\" rx=\"8\" fill=\"#232326\" data-f2c-idx=\"1121\"></rect>\n<path d=\"M11.1654 5.8335L6.91536 10.1668L4.83203 8.34865\" stroke=\"white\" stroke-opacity=\"0.7\" stroke-width=\"0.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1122\"></path>\n</svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"3656053333\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1123\"><path d=\"M 0.97 2.42 C 0.369 2.781 0.002 3.429 0 4.13 L 0 7.37 C 0.002 8.071 0.369 8.719 0.97 9.08 L 3.97 10.88 C 4.604 11.261 5.396 11.261 6.03 10.88 L 10 8.5 L 10 3 L 5 0 Z\" fill=\"transparent\" height=\"11.16561964546954px\" id=\"iqC55rNSn\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 10.5)\" width=\"10px\" data-f2c-idx=\"1124\"></path><path d=\"M 4.74 2.85 L 0 0\" fill=\"transparent\" height=\"2.8499999999999996px\" id=\"kla781KTO\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2.26 13.65)\" width=\"4.74px\" data-f2c-idx=\"1125\"></path><path d=\"M 0 3 L 5 0\" fill=\"transparent\" height=\"3px\" id=\"RZIYtVCIv\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(7 13.5)\" width=\"5px\" data-f2c-idx=\"1126\"></path><path d=\"M 0 0 L 0 5.17\" fill=\"transparent\" height=\"5.170000000000002px\" id=\"eHsnyh70C\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(7 16.5)\" width=\"1px\" data-f2c-idx=\"1127\"></path><path d=\"M 0 3 L 0 8.5 L 3.97 10.88 C 4.604 11.261 5.396 11.261 6.03 10.88 L 9.03 9.08 C 9.631 8.719 9.998 8.071 10 7.37 L 10 4.13 C 9.998 3.429 9.631 2.781 9.03 2.42 L 5 0 Z\" fill=\"transparent\" height=\"11.165619645469533px\" id=\"gGDd_JJhW\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 10.5)\" width=\"10px\" data-f2c-idx=\"1128\"></path><path d=\"M 5 3 L 0 0\" fill=\"transparent\" height=\"3px\" id=\"f9j9t117u\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 13.5)\" width=\"5px\" data-f2c-idx=\"1129\"></path><path d=\"M 0 2.85 L 4.74 0\" fill=\"transparent\" height=\"2.8499999999999996px\" id=\"LAsis0iyC\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(17 13.65)\" width=\"4.740000000000002px\" data-f2c-idx=\"1130\"></path><path d=\"M 0 0 L 0 5.17\" fill=\"transparent\" height=\"5.170000000000002px\" id=\"k6PQI4_JR\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(17 16.5)\" width=\"1px\" data-f2c-idx=\"1131\"></path><path d=\"M 0.97 2.086 C 0.369 2.446 0.002 3.095 0 3.796 L 0 8.166 L 5 11.166 L 10 8.166 L 10 3.796 C 9.998 3.095 9.631 2.446 9.03 2.086 L 6.03 0.286 C 5.396 -0.095 4.604 -0.095 3.97 0.286 Z\" fill=\"transparent\" height=\"11.165619645469537px\" id=\"Z_7hy2z9t\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(7 2.334)\" width=\"10px\" data-f2c-idx=\"1132\"></path><path d=\"M 4.74 2.85 L 0 0\" fill=\"transparent\" height=\"2.8499999999999996px\" id=\"YqvAUMKyM\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(7.26 5.15)\" width=\"4.74px\" data-f2c-idx=\"1133\"></path><path d=\"M 0 2.85 L 4.74 0\" fill=\"transparent\" height=\"2.8499999999999996px\" id=\"rGNgEDQ8V\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 5.15)\" width=\"4.740000000000002px\" data-f2c-idx=\"1134\"></path><path d=\"M 0 5.5 L 0 0\" fill=\"transparent\" height=\"5.5px\" id=\"PTlY8daQA\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 8)\" width=\"1px\" data-f2c-idx=\"1135\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"1153408925\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1136\"><path d=\"M 0.035 0.682 C -0.038 0.498 0.005 0.287 0.146 0.146 C 0.287 0.005 0.498 -0.038 0.682 0.035 L 9.682 3.535 C 9.88 3.613 10.008 3.806 10 4.019 C 9.993 4.231 9.852 4.415 9.649 4.478 L 6.205 5.546 C 5.89 5.644 5.643 5.891 5.545 6.206 L 4.478 9.649 C 4.415 9.852 4.231 9.993 4.019 10 C 3.806 10.008 3.613 9.88 3.535 9.682 Z\" fill=\"transparent\" height=\"10.000438365709865px\" id=\"W_F8AQf1c\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(11.999 11.999)\" width=\"10.000438365709858px\" data-f2c-idx=\"1137\"></path><path d=\"M 2 0 C 0.895 0 0 0.895 0 2\" fill=\"transparent\" height=\"2px\" id=\"t3Em6XTEQ\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3 3)\" width=\"2px\" data-f2c-idx=\"1138\"></path><path d=\"M 0 0 C 1.105 0 2 0.895 2 2\" fill=\"transparent\" height=\"2px\" id=\"SfPYKmEeG\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(19 3)\" width=\"2px\" data-f2c-idx=\"1139\"></path><path d=\"M 2 2 C 0.895 2 0 1.105 0 0\" fill=\"transparent\" height=\"2px\" id=\"GNE7i619m\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3 19)\" width=\"2px\" data-f2c-idx=\"1140\"></path><path d=\"M 0 0 L 1 0\" fill=\"transparent\" height=\"1px\" id=\"rSrJsDJuC\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(9 3)\" width=\"1px\" data-f2c-idx=\"1141\"></path><path d=\"M 0 0 L 2 0\" fill=\"transparent\" height=\"1px\" id=\"NUZwTVhw1\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(9 21)\" width=\"2px\" data-f2c-idx=\"1142\"></path><path d=\"M 0 0 L 1 0\" fill=\"transparent\" height=\"1px\" id=\"AAxhK_QLn\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(14 3)\" width=\"1px\" data-f2c-idx=\"1143\"></path><path d=\"M 0 0 L 0 1\" fill=\"transparent\" height=\"1px\" id=\"A1yU0VXUO\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3 9)\" width=\"1px\" data-f2c-idx=\"1144\"></path><path d=\"M 0 0 L 0 2\" fill=\"transparent\" height=\"2px\" id=\"yCwaCrZK2\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(21 9)\" width=\"1px\" data-f2c-idx=\"1145\"></path><path d=\"M 0 0 L 0 1\" fill=\"transparent\" height=\"1px\" id=\"WoLW3KM00\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3 14)\" width=\"1px\" data-f2c-idx=\"1146\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"1912074499\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1147\"><path d=\"M 0 8 L 4 4 L 0 0\" fill=\"transparent\" height=\"8px\" id=\"JylUpf0mN\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(18 8)\" width=\"4px\" data-f2c-idx=\"1148\"></path><path d=\"M 4 0 L 0 4 L 4 8\" fill=\"transparent\" height=\"8px\" id=\"W8e5sa8qb\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 8)\" width=\"4px\" data-f2c-idx=\"1149\"></path><path d=\"M 5 0 L 0 16\" fill=\"transparent\" height=\"16px\" id=\"ESjZFMRqD\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(9.5 4)\" width=\"5px\" data-f2c-idx=\"1150\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"2289257608\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1151\"><path d=\"M 18 5.998 C 17.999 5.284 17.618 4.625 17 4.268 L 10 0.268 C 9.381 -0.089 8.619 -0.089 8 0.268 L 1 4.268 C 0.382 4.625 0.001 5.284 0 5.998 L 0 13.998 C 0.001 14.712 0.382 15.371 1 15.728 L 8 19.728 C 8.619 20.085 9.381 20.085 10 19.728 L 17 15.728 C 17.618 15.371 17.999 14.712 18 13.998 Z\" fill=\"transparent\" height=\"19.995898384862247px\" id=\"w8OQW_FU0\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3 2.002)\" width=\"18px\" data-f2c-idx=\"1152\"></path><path d=\"M 0 0 L 8.7 5 L 17.4 0\" fill=\"transparent\" height=\"5px\" id=\"tIkhutySt\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3.3 7)\" width=\"17.4px\" data-f2c-idx=\"1153\"></path><path d=\"M 0 10 L 0 0\" fill=\"transparent\" height=\"10px\" id=\"iTlEFNaCB\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 12)\" width=\"1px\" data-f2c-idx=\"1154\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"2039305298\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1155\"><path d=\"M 10.827 0.18 C 10.299 -0.06 9.694 -0.06 9.167 0.18 L 0.597 4.08 C 0.234 4.24 0 4.599 0 4.995 C 0 5.392 0.234 5.75 0.597 5.91 L 9.177 9.82 C 9.704 10.061 10.309 10.061 10.837 9.82 L 19.417 5.92 C 19.779 5.76 20.013 5.402 20.013 5.005 C 20.013 4.609 19.779 4.25 19.417 4.09 Z\" fill=\"transparent\" height=\"10.00071435581102px\" id=\"xmBm0sLOm\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2.003 2)\" width=\"20.013092322505234px\" data-f2c-idx=\"1156\"></path><path d=\"M 0 0 C -0.001 0.391 0.226 0.746 0.58 0.91 L 9.18 4.82 C 9.704 5.057 10.306 5.057 10.83 4.82 L 19.41 0.92 C 19.772 0.757 20.003 0.397 20 0\" fill=\"transparent\" height=\"4.9980847988997965px\" id=\"u_ZDq_ImM\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 12)\" width=\"20.00003448900729px\" data-f2c-idx=\"1157\"></path><path d=\"M 0 0 C -0.001 0.391 0.226 0.746 0.58 0.91 L 9.18 4.82 C 9.704 5.057 10.306 5.057 10.83 4.82 L 19.41 0.92 C 19.772 0.757 20.003 0.397 20 0\" fill=\"transparent\" height=\"4.9980847988997965px\" id=\"UMi3ygNKm\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 17)\" width=\"20.00003448900729px\" data-f2c-idx=\"1158\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"894405547\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1159\"><path d=\"M 0 20 L 14 20 C 15.105 20 16 19.105 16 18 L 16 5 L 11 0 L 2 0 C 0.895 0 0 0.895 0 2 L 0 6\" fill=\"transparent\" height=\"20px\" id=\"qgjqa0E2f\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(4 2)\" width=\"16px\" data-f2c-idx=\"1160\"></path><path d=\"M 0 0 L 0 4 C 0 5.105 0.895 6 2 6 L 6 6\" fill=\"transparent\" height=\"6px\" id=\"zX2BwIxyc\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(14 2)\" width=\"6px\" data-f2c-idx=\"1161\"></path><path d=\"M 3 0 L 0 3 L 3 6\" fill=\"transparent\" height=\"6px\" id=\"NhXbVmzAP\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 12)\" width=\"3px\" data-f2c-idx=\"1162\"></path><path d=\"M 0 6 L 3 3 L 0 0\" fill=\"transparent\" height=\"6px\" id=\"Ech_qkGQt\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(9 12)\" width=\"3px\" data-f2c-idx=\"1163\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"213763526\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1164\"><path d=\"M 0 0 L 0 12\" fill=\"transparent\" height=\"12px\" id=\"aa0_kl39i\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(6 3)\" width=\"1px\" data-f2c-idx=\"1165\"></path><path d=\"M 0 3 C 0 1.343 1.343 0 3 0 C 4.657 0 6 1.343 6 3 C 6 4.657 4.657 6 3 6 C 1.343 6 0 4.657 0 3 Z\" fill=\"transparent\" height=\"6px\" id=\"W_Daewqtr\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(15 3)\" width=\"6px\" data-f2c-idx=\"1166\"></path><path d=\"M 0 3 C 0 1.343 1.343 0 3 0 C 4.657 0 6 1.343 6 3 C 6 4.657 4.657 6 3 6 C 1.343 6 0 4.657 0 3 Z\" fill=\"transparent\" height=\"6px\" id=\"YKTpx3UnI\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3 15)\" width=\"6px\" data-f2c-idx=\"1167\"></path><path d=\"M 9 0 C 9 4.971 4.971 9 0 9\" fill=\"transparent\" height=\"9px\" id=\"izswKZrxa\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(9 9)\" width=\"9px\" data-f2c-idx=\"1168\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"1255962382\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1169\"><path d=\"M 11 0 L 2 0 C 0.895 0 0 0.895 0 2 L 0 18 C 0 19.105 0.895 20 2 20 L 14 20 C 15.105 20 16 19.105 16 18 L 16 5 Z\" fill=\"transparent\" height=\"20px\" id=\"CVflWHitO\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(4 2)\" width=\"16px\" data-f2c-idx=\"1170\"></path><path d=\"M 0 0 L 0 4 C 0 5.105 0.895 6 2 6 L 6 6\" fill=\"transparent\" height=\"6px\" id=\"ab8NdQhGo\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(14 2)\" width=\"6px\" data-f2c-idx=\"1171\"></path><path d=\"M 0 4 L 2 2 L 0 0\" fill=\"transparent\" height=\"4px\" id=\"ZWow6iVjw\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(8 12)\" width=\"2px\" data-f2c-idx=\"1172\"></path><path d=\"M 0 0 L 4 0\" fill=\"transparent\" height=\"1px\" id=\"xyXYO8ZMf\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 18)\" width=\"4px\" data-f2c-idx=\"1173\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"3984941335\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1174\"><path d=\"M 0 10 C 0 4.477 4.477 0 10 0 C 15.523 0 20 4.477 20 10 C 20 15.523 15.523 20 10 20 C 4.477 20 0 15.523 0 10 Z\" fill=\"transparent\" height=\"20px\" id=\"RooPbZbXM\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 2)\" width=\"20px\" data-f2c-idx=\"1175\"></path><path d=\"M 4 0 C -1.333 5.6 -1.333 14.4 4 20 C 9.333 14.4 9.333 5.6 4 0\" fill=\"transparent\" height=\"20px\" id=\"L5Jbry1PM\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(8 2)\" width=\"8px\" data-f2c-idx=\"1176\"></path><path d=\"M 0 0 L 20 0\" fill=\"transparent\" height=\"1px\" id=\"shzTB_gWo\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 12)\" width=\"20px\" data-f2c-idx=\"1177\"></path></svg>"} />
        <SvgGraphic className={styles["svg-6"]} html={"<svg id=\"3846683765\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1178\"><path d=\"M 14 6 L 14 4 C 14 1.791 12.209 0 10 0 L 4 0 C 1.791 0 0 1.791 0 4 L 0 6\" fill=\"transparent\" height=\"6px\" id=\"d7j1E4q3I\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 15)\" width=\"14px\" data-f2c-idx=\"1179\"></path><path d=\"M 0 0 C 1.764 0.457 2.996 2.049 2.996 3.872 C 2.996 5.695 1.764 7.287 0 7.744\" fill=\"transparent\" height=\"7.744px\" id=\"KbBEY0ePJ\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(16 3.128)\" width=\"2.9961992229530807px\" data-f2c-idx=\"1180\"></path><path d=\"M 3 5.87 L 3 3.87 C 2.999 2.047 1.765 0.456 0 0\" fill=\"transparent\" height=\"5.870000000000001px\" id=\"lNurVRALF\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(19 15.13)\" width=\"3px\" data-f2c-idx=\"1181\"></path><path d=\"M 0 4 C 0 1.791 1.791 0 4 0 C 6.209 0 8 1.791 8 4 C 8 6.209 6.209 8 4 8 C 1.791 8 0 6.209 0 4 Z\" fill=\"transparent\" height=\"8px\" id=\"c5Y0LHs80\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(5 3)\" width=\"8px\" data-f2c-idx=\"1182\"></path></svg>"} />
      </div>
      <div className={styles["div-57"]}>
        <span className={styles["span-34"]}>{slots[0] ?? "Edit Content"}</span>
        <button className={styles["button"]}>
          <SvgGraphic className={styles["svg-7"]} html={"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" fill=\"none\" data-f2c-idx=\"1186\"><path d=\"M8.75 2.25a1.77 1.77 0 0 1 2.5 0h0c.69.69.69 1.81 0 2.5l-7 7h-2.5v-2.5Z\" fill=\"transparent\" stroke-width=\"1.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1187\"></path><path d=\"M8 11.75h3.75\" fill=\"transparent\" stroke-width=\"1.5\" stroke=\"currentColor\" stroke-linecap=\"round\" data-f2c-idx=\"1188\"></path></svg>"} />
        </button>
      </div>
      <div className={styles["iframe"]} />
    </>
  )
}
