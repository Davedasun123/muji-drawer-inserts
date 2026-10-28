"""VTK offscreen renders of the inserts (no GUI needed)."""
import os
import sys

import vtk

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model as M  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out")
BG = (0.965, 0.960, 0.950)


def polydata(shape, tol=0.12, ang=0.15):
    verts, faces = shape.val().tessellate(tol, ang)
    pts = vtk.vtkPoints()
    for p in verts:
        pts.InsertNextPoint(p.x, p.y, p.z)
    cells = vtk.vtkCellArray()
    for f in faces:
        cells.InsertNextCell(len(f))
        for i in f:
            cells.InsertCellPoint(i)
    pd = vtk.vtkPolyData()
    pd.SetPoints(pts)
    pd.SetPolys(cells)
    return pd


def render(actors, path, size=(2000, 1500), elev=30, azim=-62,
           parallel=False, clip_y=None, clip_all=False):
    rw = vtk.vtkRenderWindow()
    rw.SetOffScreenRendering(1)
    rw.SetSize(*size)
    rw.SetMultiSamples(8)
    ren = vtk.vtkRenderer()
    ren.SetBackground(*BG)
    ren.UseHiddenLineRemovalOn()
    rw.AddRenderer(ren)

    for pd in actors:
        if clip_y is not None:
            plane = vtk.vtkPlane()
            plane.SetOrigin(0, clip_y, 0)
            plane.SetNormal(0, 1, 0)
            cl = vtk.vtkClipPolyData()
            cl.SetInputData(pd)
            cl.SetClipFunction(plane)
            cl.Update()
            pd = cl.GetOutput()

        nrm = vtk.vtkPolyDataNormals()
        nrm.SetInputData(pd)
        nrm.SetFeatureAngle(38)
        nrm.SplittingOn()
        nrm.Update()

        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(nrm.GetOutputPort())
        actor = vtk.vtkActor()
        actor.SetMapper(mapper)
        pr = actor.GetProperty()
        pr.SetColor(0.80, 0.83, 0.87)
        pr.SetAmbient(0.32)
        pr.SetDiffuse(0.72)
        pr.SetSpecular(0.12)
        pr.SetSpecularPower(28)
        pr.SetInterpolationToPhong()
        ren.AddActor(actor)

        # crisp feature edges, drawing-board look
        fe = vtk.vtkFeatureEdges()
        fe.SetInputData(pd)
        fe.SetFeatureAngle(30)
        fe.BoundaryEdgesOff()
        fe.NonManifoldEdgesOff()
        fe.ManifoldEdgesOff()
        fe.Update()
        em = vtk.vtkPolyDataMapper()
        em.SetInputConnection(fe.GetOutputPort())
        ea = vtk.vtkActor()
        ea.SetMapper(em)
        ea.GetProperty().SetColor(0.24, 0.28, 0.34)
        ea.GetProperty().SetLineWidth(0.8)
        ren.AddActor(ea)

    lk = vtk.vtkLight()
    lk.SetPosition(0.4, -0.9, 1.0)
    lk.SetFocalPoint(0, 0, 0)
    lk.SetIntensity(0.95)
    ren.AddLight(lk)
    lk2 = vtk.vtkLight()
    lk2.SetPosition(-0.9, 0.5, 0.4)
    lk2.SetFocalPoint(0, 0, 0)
    lk2.SetIntensity(0.28)
    ren.AddLight(lk2)

    # place the camera explicitly: azim 0 looks from the drawer front (-Y)
    import math
    bnd = ren.ComputeVisiblePropBounds()
    ctr = ((bnd[0] + bnd[1]) / 2, (bnd[2] + bnd[3]) / 2, (bnd[4] + bnd[5]) / 2)
    ext = max(bnd[1] - bnd[0], bnd[3] - bnd[2], bnd[5] - bnd[4])
    er, ar = math.radians(elev), math.radians(azim)
    dist = 3.0 * ext
    cam = ren.GetActiveCamera()
    cam.SetFocalPoint(*ctr)
    cam.SetPosition(ctr[0] + dist * math.cos(er) * math.sin(ar),
                    ctr[1] - dist * math.cos(er) * math.cos(ar),
                    ctr[2] + dist * math.sin(er))
    cam.SetViewUp(0, 0, 1)
    if parallel:
        cam.ParallelProjectionOn()
        cam.SetParallelScale(ext * 0.58)
    cam.OrthogonalizeViewUp()
    ren.ResetCameraClippingRange()
    rw.Render()

    w2i = vtk.vtkWindowToImageFilter()
    w2i.SetInput(rw)
    w2i.SetScale(1)
    w2i.Update()
    wr = vtk.vtkPNGWriter()
    wr.SetFileName(os.path.join(OUT, path))
    wr.SetInputConnection(w2i.GetOutputPort())
    wr.Write()
    print("wrote", path, flush=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    placed = dict(M.build())
    A = polydata(placed["A_plier_comb"])
    B = polydata(placed["B_bits_tips_tub"])

    render([A], "A_plier_comb.png", elev=34, azim=26)
    render([B], "B_bits_tips_tub.png", elev=34, azim=-30)
    render([A, B], "assembled_iso.png", elev=38, azim=22)
    render([A, B], "assembled_top.png", elev=89.9, azim=0, parallel=True)
    C = polydata(M.COUPON[1])
    render([C], "fit_coupon.png", elev=30, azim=22)
