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

export default function PrivacyPolicy({ slots = [] }: { slots?: string[] }) {
  return (
    <>
      <RevealWatcher />
      <div className={styles["div-58"]}>
        <div className={styles["div-59"]}>
          <div className={styles["div-24"]}>
            <Navigation slots={["Asset","Overview","Features","Integrations","Benefits","About","Reviews","Pricing","Get started"]} />
          </div>
          <div className={styles["div-26"]}>
            <div className={styles["div-60"]}>
              <SmoothScroll slots={[]} />
            </div>
            <div className={styles["main"]}>
              <div className={styles["title-17"]}>
                <div className={styles["tag-10"]}>
                  <div className={styles["indicator-6"]} />
                  <div className={styles["text-22"]}>
                    <p className={styles["p-61"]}>{slots[0] ?? "February 17, 2026"}</p>
                  </div>
                </div>
                <div className={styles["title-18"]}>
                  <h1 className={styles["h1-2"]}>
                    <span className={styles["span-35"]}>{slots[1] ?? "Privacy"}</span>
                    {" "}
                    <span className={styles["span-36"]}>{slots[2] ?? "policy"}</span>
                  </h1>
                </div>
                <div className={styles["description-20"]}>
                  <div className={styles["p-62"]}>
                    <span className={styles["span-37"]}>{slots[3] ?? "Welcome"}</span>
                    {" "}
                    <span className={styles["span-38"]}>{slots[4] ?? "to"}</span>
                    {" "}
                    <span className={styles["span-39"]}>{slots[5] ?? "Asset."}</span>
                    {" "}
                    <span className={styles["span-40"]}>{slots[6] ?? "This"}</span>
                    {" "}
                    <span className={styles["span-41"]}>{slots[7] ?? "Privacy"}</span>
                    {" "}
                    <span className={styles["span-42"]}>{slots[8] ?? "policy"}</span>
                    {" "}
                    <span className={styles["span-43"]}>{slots[9] ?? "explains"}</span>
                    {" "}
                    <span className={styles["span-44"]}>{slots[10] ?? "how"}</span>
                    {" "}
                    <span className={styles["span-45"]}>{slots[11] ?? "we"}</span>
                    {" "}
                    <span className={styles["span-46"]}>{slots[12] ?? "collect,"}</span>
                    {" "}
                    <span className={styles["span-47"]}>{slots[13] ?? "use,"}</span>
                    {" "}
                    <span className={styles["span-48"]}>{slots[14] ?? "and"}</span>
                    {" "}
                    <span className={styles["span-49"]}>{slots[15] ?? "protect"}</span>
                    {" "}
                    <span className={styles["span-50"]}>{slots[16] ?? "your"}</span>
                    {" "}
                    <span className={styles["span-51"]}>{slots[17] ?? "personal"}</span>
                    {" "}
                    <span className={styles["span-52"]}>{slots[18] ?? "information"}</span>
                    {" "}
                    <span className={styles["span-53"]}>{slots[19] ?? "when"}</span>
                    {" "}
                    <span className={styles["span-54"]}>{slots[20] ?? "you"}</span>
                    {" "}
                    <span className={styles["span-54"]}>{slots[21] ?? "use"}</span>
                    {" "}
                    <span className={styles["span-55"]}>{slots[22] ?? "our"}</span>
                    {" "}
                    <span className={styles["span-56"]}>{slots[23] ?? "website."}</span>
                  </div>
                </div>
              </div>
              <div className={styles["sections"]}>
                <div className={styles["section-3"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[24] ?? "1. Information We Collect"}</h5>
                  </div>
                  <div className={styles["paragraph"]}>
                    <div className={styles["title-20"]}>
                      <p className={styles["p-63"]}>{slots[25] ?? "1.1 Personal Information"}</p>
                    </div>
                    <div className={styles["description-21"]}>
                      <p className={styles["p-64"]}>{slots[26] ?? "We may collect personal information, such as your name, email address, and other contact details when you voluntarily provide it to us. For example, when you register for an account, subscribe to newsletters, or contact us through the website."}</p>
                    </div>
                  </div>
                  <div className={styles["paragraph"]}>
                    <div className={styles["title-20"]}>
                      <p className={styles["p-63"]}>{slots[27] ?? "1.2 Usage Information"}</p>
                    </div>
                    <div className={styles["description-21"]}>
                      <p className={styles["p-64"]}>{slots[28] ?? "We may collect information about your use of the website, including your IP address, browser type, device information, and pages visited. This information helps us analyze trends, administer the site, and improve user experience."}</p>
                    </div>
                  </div>
                </div>
                <div className={styles["section-4"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[29] ?? "2. How We Use Your Information"}</h5>
                  </div>
                  <div className={styles["description-22"]}>
                    <p className={styles["p-63"]}>{slots[30] ?? "We use the collected information for various purposes, including:"}</p>
                    <ul className={styles["ul-2"]}>
                      <li className={styles["li-2"]}>
                        <p className={styles["p-65"]}>{slots[31] ?? "Providing and maintaining the website"}</p>
                      </li>
                      <li className={styles["li-2"]}>
                        <p className={styles["p-65"]}>{slots[32] ?? "Communicating with you about your account and our services"}</p>
                      </li>
                      <li className={styles["li-2"]}>
                        <p className={styles["p-65"]}>{slots[33] ?? "Sending newsletters, promotional materials, and other information you request"}</p>
                      </li>
                      <li className={styles["li-2"]}>
                        <p className={styles["p-65"]}>{slots[34] ?? "Analyzing website usage and improving our services"}</p>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className={styles["section-5"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[35] ?? "3. Sharing Your Information"}</h5>
                  </div>
                  <div className={styles["description-23"]}>
                    <p className={styles["p-66"]}>{slots[36] ?? "We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this Privacy Policy. We may share information with trusted third-party service providers who assist us in operating our website or conducting our business."}</p>
                  </div>
                </div>
                <div className={styles["section-6"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[37] ?? "4. Cookies and Similar Technologies"}</h5>
                  </div>
                  <div className={styles["description-21"]}>
                    <p className={styles["p-64"]}>{slots[38] ?? "We use cookies and similar technologies to enhance your experience on our website. You can control cookies through your browser settings, but disabling them may affect your ability to use certain features of the site."}</p>
                  </div>
                </div>
                <div className={styles["section-6"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[39] ?? "5. Your Choices"}</h5>
                  </div>
                  <div className={styles["description-21"]}>
                    <p className={styles["p-64"]}>{slots[40] ?? "You can manage your communication preferences by unsubscribing from newsletters or adjusting your account settings. You may also contact us to update or delete your personal information."}</p>
                  </div>
                </div>
                <div className={styles["section-6"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[41] ?? "6. Security"}</h5>
                  </div>
                  <div className={styles["description-21"]}>
                    <p className={styles["p-64"]}>{slots[42] ?? "We take reasonable measures to protect the security of your personal information. However, no method of transmission over the internet or electronic storage is completely secure. Therefore, we cannot guarantee absolute security."}</p>
                  </div>
                </div>
                <div className={styles["section-6"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[43] ?? "7. Children's Privacy"}</h5>
                  </div>
                  <div className={styles["description-21"]}>
                    <p className={styles["p-64"]}>{slots[44] ?? "Our website is not directed to individuals under the age of 18. If you become aware that a child has provided us with personal information, please contact us, and we will take steps to remove such information."}</p>
                  </div>
                </div>
                <div className={styles["section-6"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[45] ?? "8. Changes to This Privacy Policy"}</h5>
                  </div>
                  <div className={styles["description-21"]}>
                    <p className={styles["p-64"]}>{slots[46] ?? "We may update this Privacy Policy periodically. We will notify you of any changes by posting the new Privacy Policy on this page. Your continued use of the website after such modifications will constitute your acknowledgment of the modified Privacy Policy."}</p>
                  </div>
                </div>
                <div className={styles["section-7"]}>
                  <div className={styles["title-19"]}>
                    <h5 className={styles["h5-5"]}>{slots[47] ?? "9. Contact Us"}</h5>
                  </div>
                  <div className={styles["title-20"]}>
                    <div className={styles["p-63"]}>
                      {"If you have questions, contact us at "}
                      <a className={styles["a-3"]} href="mailto: contact@asset.com">{slots[48] ?? "contact@asset.com"}</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles["div-51"]} />
          <div className={styles["div-61"]} />
          <div className={styles["div-53"]}>
            <Footer slots={["Asset","A marketplace of real web projects you can edit visually and leave with as code you own.","©2026 webcanbe - All rights reserved.","Navigation","Overview","Features","Integrations","Benefits","Reviews","Pricing","Information","Compliance","FAQ","Contact","Privacy Policy","404 Error","Use Template","Socials","Twitter (X)","Instagram","LinkedIn"]} />
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
        <SvgGraphic className={styles["svg-4"]} html={"<svg viewBox=\"0 0 20 20\" id=\"svg10927535637\" data-f2c-idx=\"243\"><path d=\"M 13.12 14.756 C 11.424 14.597 9.815 14.934 8.467 15.721 C 7.524 16.257 6.697 17.046 5.992 17.944 L 5.517 18.638 L 5.388 18.862 L 5.879 19.108 C 5.923 19.096 5.935 19.14 5.991 19.173 C 6.103 19.237 6.202 19.258 6.358 19.31 L 6.67 19.416 L 6.875 19.125 C 6.907 19.069 6.972 18.957 7.048 18.889 C 7.664 18.015 8.427 17.338 9.294 16.869 C 10.401 16.242 11.69 15.943 13.098 16.085 C 14.261 16.198 16.55 16.104 18.854 14.305 L 18.931 14.237 L 19.027 14.07 C 19.016 14.025 19.06 14.014 19.092 13.958 C 19.241 13.634 19.391 13.311 19.485 12.955 L 20 11.352 L 18.802 12.524 C 17.039 14.225 15.203 14.954 13.12 14.756 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"244\"></path><path d=\"M 5.809 11.615 C 6.916 10.987 8.206 10.688 9.613 10.831 C 11.165 10.981 14.978 10.762 18.052 6.016 L 18.697 4.898 L 18.55 4.701 C 18.459 4.536 18.312 4.34 18.165 4.143 L 17.779 3.585 L 17.457 4.144 C 17.436 4.244 17.36 4.311 17.295 4.423 C 15.888 6.927 13.435 9.758 9.668 9.446 C 7.972 9.286 6.362 9.624 5.015 10.41 C 3.711 11.185 2.678 12.265 1.816 13.631 L 1.804 13.587 L 1.332 14.469 C 1.344 14.513 1.3 14.525 1.267 14.581 L 1.171 14.749 L 1.262 14.913 C 1.365 15.122 1.512 15.319 1.615 15.527 L 2.068 16.162 L 2.355 15.47 C 2.376 15.37 2.452 15.303 2.473 15.203 C 3.174 14.117 4.133 12.584 5.809 11.615 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"245\"></path><path d=\"M 1.323 11.967 C 2.053 10.638 3.022 9.669 4.161 8.986 C 5.268 8.358 6.558 8.059 7.965 8.201 C 12.32 8.593 15.119 5.29 16.275 3.61 L 16.694 2.884 L 16.867 2.648 L 16.62 2.431 C 16.453 2.334 16.317 2.181 16.138 2.041 L 15.779 1.759 L 15.554 2.15 C 15.521 2.206 15.457 2.318 15.425 2.374 C 14.046 4.633 11.666 7.209 8.075 6.849 C 6.38 6.69 4.77 7.027 3.422 7.814 C 2.568 8.326 1.805 9.003 1.077 9.813 L 0.352 10.81 C 0.288 10.922 0.256 10.978 0.191 11.09 L 0.127 11.202 L 0.162 11.334 C 0.201 11.654 0.283 11.963 0.31 12.239 L 0.561 13.353 L 1.097 12.359 C 1.162 12.247 1.215 12.091 1.323 11.967 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"246\"></path><path d=\"M 15.2 17.412 C 15.056 17.403 14.956 17.383 14.812 17.374 C 13.116 17.214 11.507 17.551 10.159 18.338 C 9.874 18.509 9.589 18.68 9.316 18.895 L 8.389 19.664 L 8.16 19.867 L 9.124 19.939 C 9.412 19.957 9.7 19.974 9.988 19.991 L 10.132 20 L 10.252 19.92 C 10.372 19.841 10.481 19.717 10.613 19.682 C 10.701 19.658 10.777 19.59 10.854 19.523 C 11.84 18.974 12.986 18.667 14.326 18.733 C 14.47 18.742 14.57 18.762 14.714 18.771 L 14.957 18.8 L 15.078 18.721 C 15.363 18.55 15.691 18.367 15.921 18.164 L 17.036 17.392 L 15.676 17.426 C 15.532 17.417 15.344 17.42 15.2 17.412 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"247\"></path><path d=\"M 19.498 6.478 L 19.014 7.317 C 18.95 7.429 18.885 7.54 18.821 7.652 C 17.475 9.856 15.062 12.487 11.472 12.127 C 9.776 11.968 8.166 12.305 6.819 13.092 C 5.559 13.855 4.514 14.891 3.696 16.245 L 3.288 17.015 L 3.171 17.283 L 3.418 17.5 C 3.598 17.641 3.721 17.75 3.856 17.903 L 4.227 18.228 L 4.429 17.749 C 4.461 17.693 4.526 17.581 4.558 17.525 C 5.309 16.096 6.266 15.083 7.493 14.376 C 8.6 13.748 9.889 13.45 11.297 13.592 C 12.505 13.693 13.685 13.518 14.796 13.079 C 16.763 12.315 18.483 10.625 19.639 8.945 C 19.703 8.833 19.78 8.765 19.844 8.653 L 19.941 8.486 L 19.906 8.353 C 19.835 8.089 19.796 7.768 19.726 7.504 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"248\"></path><path d=\"M 1.67 6.913 C 1.899 6.71 2.184 6.539 2.425 6.38 C 3.532 5.752 4.821 5.454 6.229 5.596 C 7.149 5.68 8.021 5.588 8.946 5.34 C 10.797 4.843 12.47 3.686 13.846 1.946 L 14.539 1.005 L 14.059 0.803 C 13.892 0.706 13.68 0.621 13.48 0.58 L 13.169 0.474 L 12.996 0.71 C 12.919 0.778 12.899 0.878 12.823 0.945 C 10.96 3.335 8.754 4.446 6.327 4.199 C 4.588 4.052 2.966 4.345 1.51 5.255 C 1.389 5.335 1.269 5.414 1.105 5.506 L 1.028 5.573 L 0.932 5.741 C 0.943 5.785 0.899 5.797 0.867 5.853 C 0.762 6.165 0.6 6.444 0.495 6.756 L 0 8.259 L 1.177 7.187 C 1.397 7.128 1.55 6.993 1.67 6.913 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"249\"></path><path d=\"M 4.481 2.947 L 4.625 2.956 C 5.257 3.023 6.197 3.007 7.298 2.711 C 8.444 2.404 9.475 1.844 10.458 1.108 L 11.647 0.08 L 10.639 0.019 C 10.351 0.002 10.063 -0.015 9.743 0.023 L 9.61 0.059 L 9.49 0.138 C 9.37 0.218 9.261 0.341 9.141 0.421 C 7.949 1.261 6.651 1.703 5.279 1.693 C 5.135 1.685 4.991 1.676 4.847 1.667 L 4.703 1.659 L 4.582 1.738 C 4.342 1.897 4.101 2.056 3.872 2.26 L 2.977 2.973 L 4.117 2.998 C 4.193 2.93 4.337 2.939 4.481 2.947 Z\" fill=\"var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255))\" data-f2c-idx=\"250\"></path></svg>"} />
      </div>
      <div className={styles["div-57"]}>
        <span className={styles["span-34"]}>{slots[0] ?? "Edit Content"}</span>
        <button className={styles["button"]}>
          <SvgGraphic className={styles["svg-7"]} html={"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" fill=\"none\" data-f2c-idx=\"254\"><path d=\"M8.75 2.25a1.77 1.77 0 0 1 2.5 0h0c.69.69.69 1.81 0 2.5l-7 7h-2.5v-2.5Z\" fill=\"transparent\" stroke-width=\"1.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"255\"></path><path d=\"M8 11.75h3.75\" fill=\"transparent\" stroke-width=\"1.5\" stroke=\"currentColor\" stroke-linecap=\"round\" data-f2c-idx=\"256\"></path></svg>"} />
        </button>
      </div>
      <div className={styles["iframe"]} />
    </>
  )
}
