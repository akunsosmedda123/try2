import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../state/AppContext';
import { HomeTableDB } from '../db/db';
import App from '../ui/App';

let n = 0;
let db: HomeTableDB;
const mount = (path = '/') => render(<AppProvider database={db}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></AppProvider>);
beforeEach(() => { db = new HomeTableDB(`ui-${++n}-${Math.random()}`); vi.setSystemTime(new Date('2026-11-10T08:00:00')); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('UI smoke', () => {
  it('memuat Home dengan navigasi bawah lima item (bahasa Indonesia)', async () => {
    mount();
    await screen.findByText('HOME TABLE');
    const nav = await screen.findByRole('navigation', { name: 'Navigasi utama' });
    for (const l of ['Home', 'Meal Plan', 'Grocery', 'Kitchen', 'Settings']) expect(within(nav).getByText(l)).toBeInTheDocument();
  });
  it('Meal Plan menampilkan menu hari ini dan tab validasi', async () => {
    mount('/rencana');
    await screen.findByRole('heading', { name: 'Meal Plan' });
    await screen.findByText(/Sarapan ibu/);
    await userEvent.click(screen.getByRole('tab', { name: 'Validasi' }));
    await screen.findByText('Menu wajib bulanan');
    expect(screen.getByText('Checklist mingguan (Senin–Minggu)')).toBeInTheDocument();
  });
  it('Meal Plan: tab Bulan memuat 30 hari', async () => {
    mount('/rencana');
    await userEvent.click(await screen.findByRole('tab', { name: 'Bulan' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^(Sen|Sel|Rab|Kam|Jum|Sab|Min)/ }).length).toBe(30));
  });
  it('Generate Menu: pratinjau muncul dan belum menyimpan apa pun', async () => {
    mount('/rencana');
    await userEvent.click(await screen.findByRole('button', { name: 'Generate' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Buat pratinjau' }));
    await screen.findByTestId('gen-preview', undefined, { timeout: 15000 });
    expect(await db.plans.count()).toBe(1);
  }, 30000);
  it('Grocery: daftar belanja minggu ini tampil dengan label estimasi', async () => {
    mount('/belanja');
    await screen.findByText('Ringkasan');
    expect(screen.getAllByText(/estimasi/i).length).toBeGreaterThan(0);
  });
  it('Pantry kosong menawarkan impor contoh, dan contoh TIDAK aktif otomatis', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount('/dapur/pantry');
    await userEvent.click(await screen.findByRole('button', { name: 'Impor contoh stok' }));
    await screen.findAllByText('Belum dikonfirmasi');
    expect(screen.queryByText('Dihitung sebagai stok')).not.toBeInTheDocument();
    expect((await db.pantry.toArray()).every((p) => !p.confirmed)).toBe(true);
  });
  it('Recipe Library: pencarian dan detail resep dengan tautan YouTube', async () => {
    mount('/dapur/resep');
    await userEvent.type(await screen.findByLabelText('Cari resep'), 'rawon');
    await userEvent.click((await screen.findAllByRole('link', { name: /rawon daging sapi/i }))[0]);
    const a = await screen.findByRole('link', { name: 'Cari di YouTube' });
    expect(a.getAttribute('href')).toContain('youtube.com/results?search_query=');
  });
  it('Resep baru: validasi form menolak nama kosong', async () => {
    mount('/dapur/resep/baru');
    await userEvent.click(await screen.findByRole('button', { name: 'Simpan resep' }));
    await screen.findByText('Nama minimal 2 huruf');
  });
  it('Food Journal menyimpan catatan dan Growth Tracker menyimpan pertumbuhan', async () => {
    mount('/balita/jurnal');
    await userEvent.type(await screen.findByLabelText('Nama menu'), 'Ayam kuning');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan catatan' }));
    await waitFor(async () => expect(await db.journal.count()).toBe(1));
    cleanup();
    mount('/balita/tumbuh');
    fireEvent.change(await screen.findByLabelText('Berat'), { target: { value: '14.5' } });
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(async () => expect(await db.growth.count()).toBe(1));
  });
  it('Settings: mengganti mode budget memperbarui target mingguan', async () => {
    mount('/pengaturan');
    const sel = await screen.findByDisplayValue(/HEMAT/);
    await userEvent.selectOptions(sel, 'NORMAL');
    await waitFor(async () => expect(((await db.kv.get('settings'))!.value as { prefs: { weeklyBudget: number } }).prefs.weeklyBudget).toBe(350000));
  });
});
