import styles from "./styles.module.css"

export default function LogoCard({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default-7"]}>
        <div className={styles["airtable"]}>
          <div className={styles["div-10"]}>
            <img className={styles["img-4"]} src={slots[0] ?? "https://framerusercontent.com/images/EEj4wGO65VnHSf2Tx0kTo9JeVCg.png?width=256&height=256"} alt="" />
          </div>
        </div>
      </div>
  )
}
