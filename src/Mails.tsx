import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function Mails({ slots = [] }: { slots?: string[] }) {
  return (
      <SvgGraphic className={styles["icon"]} html={"<svg data-framer-name=\"Icon\" class=\"framer-J9upn framer-p58exi\" role=\"presentation\" viewBox=\"0 0 24 24\" data-f2c-idx=\"80\"><use href=\"#2458221120\" data-f2c-idx=\"81\"></use></svg>"} />
  )
}
