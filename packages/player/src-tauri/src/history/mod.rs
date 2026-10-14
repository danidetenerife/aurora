pub mod commands;
pub mod fingerprint;
pub mod reads;
pub mod stats;
pub mod types;
pub mod writes;

use sqlx::sqlite::SqlitePool;
use tauri::Manager;

pub struct HistoryDb(pub SqlitePool);

impl HistoryDb {
    pub(crate) fn pool(&self) -> &SqlitePool {
        &self.0
    }
}

pub fn init_history(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let data_dir = match app_handle.path().app_data_dir() {
            Ok(dir) => dir,
            Err(err) => {
                log::error!("Failed to resolve app data dir: {err}");
                return;
            }
        };

        let db_path = data_dir.join("databases").join("history.db");
        let pool = match crate::db::open(&db_path).await {
            Ok(p) => match sqlx::migrate!("./migrations/history").run(&p).await {
                Ok(_) => p,
                Err(err) => {
                    log::error!("History migration failed: {err}. Attempting recovery...");
                    p.close().await;
                    drop(p);
                    let backup_name = format!(
                        "history.db.corrupt.{}",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs()
                    );
                    let backup_path = db_path.with_file_name(backup_name);
                    let _ = std::fs::rename(&db_path, backup_path);
                    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
                    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
                    match crate::db::open(&db_path).await {
                        Ok(new_p) => {
                            if let Err(migration_error) = sqlx::migrate!("./migrations/history").run(&new_p).await {
                                log::error!("Fatal: Failed to migrate fresh history db: {migration_error}");
                                return;
                            }
                            new_p
                        }
                        Err(open_error) => {
                            log::error!("Fatal: Failed to open fresh history db: {open_error}");
                            return;
                        }
                    }
                }
            },
            Err(err) => {
                log::error!("Failed to open history database: {err}");
                return;
            }
        };

        app_handle.manage(HistoryDb(pool));
        log::info!("History database initialized");
    });
}

#[cfg(test)]
pub mod fixtures;
